package packaging

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/errutil"
	"github.com/grafana/grafana/pkg/build/grafana"
	"github.com/grafana/grafana/pkg/build/plugins"
	"github.com/grafana/grafana/pkg/build/syncutil"
	"github.com/grafana/grafana/pkg/infra/fs"
)

var (
	ErrorNoBinaries = errors.New("no binaries found")
	ErrorNoDebArch  = errors.New("deb architecture not defined")
	ErrorNoRPMArch  = errors.New("rpm architecture not defined")
)

const (
	maxAttempts          = 3
	enterpriseSfx        = "-enterprise"
	enterprise2Sfx       = "-enterprise2"
	DefaultDebDBBucket   = "grafana-aptly-db"
	DefaultDebRepoBucket = "grafana-repo"
	DefaultRPMRepoBucket = "grafana-repo"
	DefaultTTLSeconds    = "300"
)

// PackageRegexp returns a regexp for matching packages corresponding to a certain Grafana edition.
func PackageRegexp(edition config.Edition) *regexp.Regexp {
	var sfx string
	switch edition {
	case config.EditionOSS:
	case config.EditionEnterprise:
		sfx = "-enterprise"
	case config.EditionEnterprise2:
		sfx = "-enterprise2"
	default:
		panic(fmt.Sprintf("unrecognized edition %q", edition))
	}
	rePkg, err := regexp.Compile(fmt.Sprintf(`^grafana%s(?:-rpi)?[-_][^-_]+.*$`, sfx))
	if err != nil {
		panic(fmt.Sprintf("Failed to compile regexp: %s", err))
	}

	return rePkg
}

// PackageGrafana packages Grafana for various variants.
func PackageGrafana(
	ctx context.Context,
	version string,
	grafanaDir string,
	cfg config.Config,
	edition config.Edition,
	variants []config.Variant,
	shouldSign bool,
	p syncutil.WorkerPool,
) error {
	if err := packageGrafana(ctx, edition, version, grafanaDir, variants, shouldSign, p); err != nil {
		return err
	}

	if cfg.SignPackages {
		if err := signRPMPackages(edition, cfg, grafanaDir); err != nil {
			return err
		}
	}

	if err := checksumPackages(grafanaDir, edition); err != nil {
		return err
	}

	return nil
}

func packageGrafana(
	ctx context.Context,
	edition config.Edition,
	version string,
	grafanaDir string,
	variants []config.Variant,
	shouldSign bool,
	p syncutil.WorkerPool,
) error {
	distDir := filepath.Join(grafanaDir, "dist")
	exists, err := fs.Exists(distDir)
	if err != nil {
		return err
	}
	if !exists {
		log.Printf("directory %s doesn't exist - creating...", distDir)
		//nolint
		if err := os.MkdirAll(distDir, 0o755); err != nil {
			return fmt.Errorf("couldn't create dist: %w", err)
		}
	}

	var m pluginsManifest
	manifestPath := filepath.Join(grafanaDir, "plugins-bundled", "external.json")
	//nolint:gosec
	manifestB, err := os.ReadFile(manifestPath)
	if err != nil {
		return fmt.Errorf("failed to open plugins manifest %q: %w", manifestPath, err)
	}
	if err := json.Unmarshal(manifestB, &m); err != nil {
		return err
	}

	g, ctx := errutil.GroupWithContext(ctx)
	for _, v := range variants {
		packageVariant(ctx, v, edition, version, grafanaDir, shouldSign, g, p, m)
	}
	if err := g.Wait(); err != nil {
		return err
	}

	return nil
}

// packageVariant packages Grafana for a certain variant.
func packageVariant(
	ctx context.Context,
	v config.Variant,
	edition config.Edition,
	version string,
	grafanaDir string,
	shouldSign bool,
	g *errutil.Group,
	p syncutil.WorkerPool,
	m pluginsManifest,
) {
	p.Schedule(g.Wrap(func() error {
		// We've experienced spurious packaging failures, so retry on failure.
		i := 0
		for {
			if err := realPackageVariant(ctx, v, edition, version, grafanaDir, m, shouldSign); err != nil {
				i++
				if i < maxAttempts {
					log.Printf("Packaging for variant %s, %s edition failed: %s, trying again", v, edition, err)
					continue
				}

				return err
			}

			break
		}

		return nil
	}))
}

// signRPMPackages signs the RPM packages.
func signRPMPackages(edition config.Edition, cfg config.Config, grafanaDir string) error {
	log.Printf("Signing %s RPM packages...", edition)
	var sfx string
	switch edition {
	case config.EditionOSS:
	case config.EditionEnterprise:
		sfx = enterpriseSfx
	case config.EditionEnterprise2:
		sfx = enterprise2Sfx
	default:
		panic(fmt.Sprintf("Unrecognized edition %s", edition))
	}
	rpms, err := filepath.Glob(filepath.Join(grafanaDir, "dist", fmt.Sprintf("grafana%s-*.rpm", sfx)))
	if err != nil {
		return err
	}

	if len(rpms) > 0 {
		rpmArgs := append([]string{"--addsign"}, rpms...)
		log.Printf("Invoking rpm with args: %+v", rpmArgs)
		//nolint:gosec
		cmd := exec.Command("rpm", rpmArgs...)
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("failed to sign RPM packages: %s", output)
		}
		if err := os.Remove(cfg.GPGPassPath); err != nil {
			return fmt.Errorf("failed to remove %q: %w", cfg.GPGPassPath, err)
		}

		log.Printf("Verifying %s RPM packages...", edition)
		// The output changed between rpm versions
		reOutput := regexp.MustCompile("(?:digests signatures OK)|(?:pgp.+OK)")
		for _, p := range rpms {
			//nolint:gosec
			cmd := exec.Command("rpm", "-K", p)
			output, err := cmd.CombinedOutput()
			if err != nil {
				return fmt.Errorf("failed to verify RPM signature: %w", err)
			}

			if !reOutput.Match(output) {
				return fmt.Errorf("RPM package %q not verified: %s", p, output)
			}
		}
	}

	return nil
}

// checksumPackages generates package checksums with SHA-256.
func checksumPackages(grafanaDir string, edition config.Edition) error {
	log.Printf("Checksumming %s packages...", edition)
	distDir := filepath.Join(grafanaDir, "dist")
	rePkg := PackageRegexp(edition)
	if err := filepath.Walk(distDir, func(fpath string, info os.FileInfo, err error) error {
		if err != nil {
			var pathErr *os.PathError
			if errors.As(err, &pathErr) {
				log.Printf("path error in walk function for file %q: %s", pathErr.Path, pathErr.Err.Error())
				return nil
			}
			return fmt.Errorf("walking through dist folder failed: %w", err)
		}

		if info.IsDir() {
			return nil
		}

		fname := filepath.Base(fpath)
		if strings.HasSuffix(fname, ".sha256") || strings.HasSuffix(fname, ".version") || !rePkg.MatchString(fname) {
			log.Printf("Ignoring non-package %q", fpath)
			return nil
		}

		return shaFile(fpath)
	}); err != nil {
		return fmt.Errorf("checksumming packages in %q failed: %w", distDir, err)
	}

	log.Printf("Successfully checksummed %s packages", edition)
	return nil
}

func shaFile(fpath string) error {
	//nolint:gosec
	fd, err := os.Open(fpath)
	if err != nil {
		return fmt.Errorf("failed to open %q: %w", fpath, err)
	}
	defer func() {
		if err := fd.Close(); err != nil {
			log.Println(err)
		}
	}()

	h := sha256.New()
	_, err = io.Copy(h, fd)
	if err != nil {
		return fmt.Errorf("failed to read %q: %w", fpath, err)
	}

	//nolint:gosec
	out, err := os.Create(fpath + ".sha256")
	if err != nil {
		return fmt.Errorf("failed to create %q: %w", fpath+".sha256", err)
	}
	defer func() {
		if err := out.Close(); err != nil {
			log.Println("failed to close file", out.Name())
		}
	}()

	if _, err = fmt.Fprintf(out, "%x\n", h.Sum(nil)); err != nil {
		return fmt.Errorf("failed to write %q: %w", out.Name(), err)
	}

	return nil
}

// createPackage creates a Linux package.
func createPackage(srcDir string, options linuxPackageOptions) error {
	binary := "grafana"
	cliBinary := "grafana-cli"
	serverBinary := "grafana-server"

	packageRoot, err := os.MkdirTemp("", "grafana-linux-pack")
	if err != nil {
		return fmt.Errorf("failed to create temporary directory: %w", err)
	}
	defer func() {
		if err := os.RemoveAll(packageRoot); err != nil {
			log.Println(err)
		}
	}()

	for _, dname := range []string{
		options.homeDir,
		options.configDir,
		"etc/init.d",
		options.etcDefaultPath,
		"usr/lib/systemd/system",
		"usr/sbin",
	} {
		dpath := filepath.Join(packageRoot, dname)
		//nolint
		if err := os.MkdirAll(dpath, 0o755); err != nil {
			return fmt.Errorf("failed to make directory %q: %w", dpath, err)
		}
	}

	if err := fs.CopyFile(filepath.Join(options.wrapperFilePath, binary),
		filepath.Join(packageRoot, "usr", "sbin", binary)); err != nil {
		return err
	}
	if err := fs.CopyFile(filepath.Join(options.wrapperFilePath, cliBinary),
		filepath.Join(packageRoot, "usr", "sbin", cliBinary)); err != nil {
		return err
	}
	if err := fs.CopyFile(filepath.Join(options.wrapperFilePath, serverBinary),
		filepath.Join(packageRoot, "usr", "sbin", serverBinary)); err != nil {
		return err
	}
	if err := fs.CopyFile(options.initdScriptSrc, filepath.Join(packageRoot, options.initdScriptFilePath)); err != nil {
		return err
	}
	if err := fs.CopyFile(options.defaultFileSrc, filepath.Join(packageRoot, options.etcDefaultFilePath)); err != nil {
		return err
	}
	if err := fs.CopyFile(options.systemdFileSrc, filepath.Join(packageRoot, options.systemdServiceFilePath)); err != nil {
		return err
	}
	if err := fs.CopyRecursive(srcDir, filepath.Join(packageRoot, options.homeDir)); err != nil {
		return err
	}

	if err := executeFPM(options, packageRoot, srcDir); err != nil {
		return err
	}

	return nil
}
func executeFPM(options linuxPackageOptions, packageRoot, srcDir string) error {
	name := "grafana"
	vendor := "Grafana"
	if options.edition == config.EditionEnterprise || options.edition == config.EditionEnterprise2 {
		vendor += " Enterprise"
		if options.edition == config.EditionEnterprise2 {
			name += enterprise2Sfx
		} else if options.edition == config.EditionEnterprise {
			name += enterpriseSfx
		}
	}

	if options.goArch == config.ArchARM && options.goArm == "6" {
		name += "-rpi"
	}

	pkgVersion := packageVersion(options)
	args := []string{
		"-s", "dir",
		"--description", "Grafana",
		"-C", packageRoot,
		"--url", "https://grafana.com",
		"--maintainer", "contact@grafana.com",
		"--config-files", options.initdScriptFilePath,
		"--config-files", options.etcDefaultFilePath,
		"--config-files", options.systemdServiceFilePath,
		"--after-install", options.postinstSrc,
		"--version", pkgVersion,
		"-p", "dist/",
		"--name", name,
		"--vendor", vendor,
		"-a", string(options.packageArch),
	}
	if options.prermSrc != "" {
		args = append(args, "--before-remove", options.prermSrc)
	}
	if options.edition == config.EditionEnterprise || options.edition == config.EditionEnterprise2 || options.goArch == config.ArchARMv6 {
		args = append(args, "--conflicts", "grafana")
	}
	if options.edition == config.EditionOSS {
		args = append(args, "--license", "\"AGPLv3\"")
	}
	switch options.packageType {
	case packageTypeRpm:
		args = append(args, "-t", "rpm", "--rpm-posttrans", "packaging/rpm/control/posttrans")
		args = append(args, "--rpm-digest", "sha256")
	case packageTypeDeb:
		args = append(args, "-t", "deb", "--deb-no-default-config-files")
	default:
		panic(fmt.Sprintf("Unrecognized package type %d", options.packageType))
	}
	for _, dep := range options.depends {
		args = append(args, "--depends", dep)
	}
	args = append(args, ".")

	distDir := filepath.Join(options.grafanaDir, "dist")
	log.Printf("Generating package in %q (source directory %q)", distDir, srcDir)

	cmdStr := "fpm"
	for _, arg := range args {
		if strings.Contains(arg, " ") {
			arg = fmt.Sprintf("'%s'", arg)
		}
		cmdStr += fmt.Sprintf(" %s", arg)
	}
	log.Printf("Creating %s package: %s...", options.packageType, cmdStr)
	const rvmPath = "/etc/profile.d/rvm.sh"
	exists, err := fs.Exists(rvmPath)
	if err != nil {
		return err
	}
	if exists {
		cmdStr = fmt.Sprintf("source %q && %s", rvmPath, cmdStr)
		log.Printf("Sourcing %q before running fpm", rvmPath)
	}
	//nolint:gosec
	cmd := exec.Command("/bin/bash", "-c", cmdStr)
	cmd.Dir = options.grafanaDir
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to run fpm: %s", output)
	}

	return nil
}

// copyPubDir copies public/ from grafanaDir to tmpDir.
func copyPubDir(grafanaDir, tmpDir string) error {
	srcPubDir := filepath.Join(grafanaDir, "public")
	tgtPubDir := filepath.Join(tmpDir, "public")
	log.Printf("Copying %q to %q...", srcPubDir, tgtPubDir)
	if err := fs.CopyRecursive(srcPubDir, tgtPubDir); err != nil {
		return fmt.Errorf("failed to copy %q to %q: %w", srcPubDir, tgtPubDir, err)
	}

	return nil
}

// copyBinaries copies binaries from grafanaDir into tmpDir.
func copyBinaries(grafanaDir, tmpDir string, args grafana.BuildArgs, edition config.Edition) error {
	tgtDir := filepath.Join(tmpDir, "bin")
	//nolint
	if err := os.MkdirAll(tgtDir, 0o755); err != nil {
		return fmt.Errorf("failed to make directory %q: %w", tgtDir, err)
	}

	binDir := filepath.Join(grafanaDir, "bin", grafana.BinaryFolder(edition, args))

	files, err := os.ReadDir(binDir)
	if err != nil {
		return fmt.Errorf("failed to list files in %q: %w", binDir, err)
	}

	if len(files) == 0 {
		return fmt.Errorf("%w in %s", ErrorNoBinaries, binDir)
	}

	for _, file := range files {
		srcPath := filepath.Join(binDir, file.Name())
		tgtPath := filepath.Join(tgtDir, file.Name())

		if err := fs.CopyFile(srcPath, tgtPath); err != nil {
			return err
		}
	}

	return nil
}

// copyConfFiles copies configuration files from grafanaDir into tmpDir.
func copyConfFiles(grafanaDir, tmpDir string) error {
	//nolint:gosec
	if err := os.MkdirAll(filepath.Join(tmpDir, "conf"), 0o755); err != nil {
		return fmt.Errorf("failed to create dir %q: %w", filepath.Join(tmpDir, "conf"), err)
	}

	confDir := filepath.Join(grafanaDir, "conf")
	infos, err := os.ReadDir(confDir)
	if err != nil {
		return fmt.Errorf("failed to list files in %q: %w", confDir, err)
	}
	for _, info := range infos {
		fpath := filepath.Join(confDir, info.Name())
		if err := fs.CopyRecursive(fpath, filepath.Join(tmpDir, "conf", info.Name())); err != nil {
			return err
		}
	}

	return nil
}

// copyPlugins copies plugins from grafanaDir into tmpDir.
func copyPlugins(ctx context.Context, v config.Variant, grafanaDir, tmpDir string, m pluginsManifest, shouldSign bool) error {
	log.Printf("Copying plugins for package variant %s...", v)

	variant2Sfx := map[config.Variant]string{
		config.VariantLinuxAmd64:   "linux_amd64",
		config.VariantDarwinAmd64:  "darwin_amd64",
		config.VariantWindowsAmd64: "windows_amd64.exe",
	}

	tgtDir := filepath.Join(tmpDir, "plugins-bundled")
	exists, err := fs.Exists(tgtDir)
	if err != nil {
		return err
	}
	if !exists {
		//nolint:gosec
		if err := os.MkdirAll(tgtDir, 0o755); err != nil {
			return err
		}
	}
	pluginsDir := filepath.Join(grafanaDir, "plugins-bundled")

	// External plugins.
	for _, pm := range m.Plugins {
		srcDir := filepath.Join(pluginsDir, fmt.Sprintf("%s-%s", pm.Name, pm.Version))
		dstDir := filepath.Join(tgtDir, fmt.Sprintf("%s-%s", pm.Name, pm.Version))
		log.Printf("Copying external plugin %q to %q...", srcDir, dstDir)

		//nolint:gosec
		jsonB, err := os.ReadFile(filepath.Join(srcDir, "plugin.json"))
		if err != nil {
			return fmt.Errorf("failed to read %q: %w", filepath.Join(srcDir, "plugin.json"), err)
		}
		var plugJSON map[string]interface{}
		if err := json.Unmarshal(jsonB, &plugJSON); err != nil {
			return err
		}

		plugExe, ok := plugJSON["executable"].(string)
		var wantExe string
		if ok && strings.TrimSpace(plugExe) != "" {
			sfx := variant2Sfx[v]
			if sfx == "" {
				log.Printf("External plugin %s-%s doesn't have an executable for variant %s - ignoring",
					pm.Name, pm.Version, v)
				continue
			}

			wantExe = fmt.Sprintf("%s_%s", plugExe, sfx)
			log.Printf("The external plugin should contain an executable %q", wantExe)
			exists, err := fs.Exists(filepath.Join(srcDir, wantExe))
			if err != nil {
				return err
			}
			if !exists {
				log.Printf("External plugin %s-%s doesn't have an executable of the right format: %q - ignoring",
					pm.Name, pm.Version, wantExe)
				continue
			}
		}

		if err := filepath.Walk(srcDir, func(pth string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}

			log.Printf("Handling %q", pth)

			relPath := strings.TrimPrefix(pth, srcDir)
			relPath = strings.TrimPrefix(relPath, "/")
			dstPath := filepath.Join(dstDir, relPath)

			if info.IsDir() {
				log.Printf("Making directory %q", dstPath)
				//nolint:gosec
				return os.MkdirAll(dstPath, info.Mode())
			}

			if wantExe != "" {
				m, err := regexp.MatchString(fmt.Sprintf(`^%s_[^/]+$`, plugExe), relPath)
				if err != nil {
					return err
				}
				if m && relPath != wantExe {
					// Ignore other executable variants
					log.Printf("Ignoring executable variant %q", pth)
					return nil
				}
			}

			log.Printf("Copying %q to %q", pth, dstPath)
			return fs.CopyFile(pth, dstPath)
		}); err != nil {
			return fmt.Errorf("failed to copy external plugin %q to %q: %w", srcDir, dstDir, err)
		}

		if shouldSign {
			if err := plugins.BuildManifest(ctx, dstDir, true); err != nil {
				return fmt.Errorf("failed to generate signed manifest for external plugin %q: %w", dstDir, err)
			}
		}
	}

	return copyInternalPlugins(pluginsDir, tmpDir)
}

func copyInternalPlugins(pluginsDir, tmpDir string) error {
	tgtDir := filepath.Join(tmpDir, "plugins-bundled", "internal")
	srcDir := filepath.Join(pluginsDir, "dist")

	exists, err := fs.Exists(tgtDir)
	if err != nil {
		return err
	}
	if !exists {
		//nolint:gosec
		if err := os.MkdirAll(tgtDir, 0o755); err != nil {
			return err
		}
	}

	// Copy over internal plugins.
	fis, err := os.ReadDir(srcDir)
	if err != nil {
		return fmt.Errorf("failed to list internal plugins in %q: %w", srcDir, err)
	}
	for _, fi := range fis {
		srcPath := filepath.Join(srcDir, fi.Name())
		if !fi.IsDir() {
			log.Printf("Ignoring non-directory %q", srcPath)
			continue
		}

		dstPath := filepath.Join(tgtDir, fi.Name())
		log.Printf("Copying internal plugin %q to %q...", srcPath, dstPath)
		if err := fs.CopyRecursive(srcPath, dstPath); err != nil {
			return fmt.Errorf("failed to copy %q to %q: %w", srcPath, dstPath, err)
		}
	}

	return nil
}

func realPackageVariant(ctx context.Context, v config.Variant, edition config.Edition, version, grafanaDir string,
	m pluginsManifest, shouldSign bool) error {
	log.Printf("Packaging Grafana %s for %s...", edition, v)

	enableDeb := false
	enableRpm := false
	switch v {
	case config.VariantLinuxAmd64:
		enableDeb = true
		enableRpm = true
	case config.VariantArmV6:
		enableDeb = true
	case config.VariantArmV7:
		enableDeb = true
		enableRpm = true
	case config.VariantArm64:
		enableDeb = true
		enableRpm = true
	default:
	}

	tmpDir, err := os.MkdirTemp("", "")
	if err != nil {
		return fmt.Errorf("failed to create temporary directory: %w", err)
	}
	defer func() {
		if err := os.RemoveAll(tmpDir); err != nil {
			log.Println(err)
		}
	}()

	args := grafana.VariantBuildArgs(v)

	if err := copyPubDir(grafanaDir, tmpDir); err != nil {
		return err
	}
	if err := copyBinaries(grafanaDir, tmpDir, args, edition); err != nil {
		return err
	}
	if err := copyConfFiles(grafanaDir, tmpDir); err != nil {
		return err
	}
	if err := copyPlugins(ctx, v, grafanaDir, tmpDir, m, shouldSign); err != nil {
		return err
	}

	if v == config.VariantWindowsAmd64 {
		toolsDir := filepath.Join(tmpDir, "tools")
		//nolint:gosec
		if err := os.MkdirAll(toolsDir, 0o755); err != nil {
			return fmt.Errorf("failed to create tools dir %q: %w", toolsDir, err)
		}

		if err := fs.CopyFile("/usr/local/go/lib/time/zoneinfo.zip",
			filepath.Join(tmpDir, "tools", "zoneinfo.zip")); err != nil {
			return err
		}
	}

	if err := os.WriteFile(filepath.Join(tmpDir, "VERSION"), []byte(version), 0664); err != nil {
		return fmt.Errorf("failed to write %s/VERSION: %w", tmpDir, err)
	}

	if err := createArchive(tmpDir, edition, v, version, grafanaDir); err != nil {
		return err
	}

	if enableDeb {
		if args.DebArch == "" {
			return fmt.Errorf("%w for %s", ErrorNoDebArch, v)
		}

		if err := createPackage(tmpDir, linuxPackageOptions{
			edition:                edition,
			version:                version,
			grafanaDir:             grafanaDir,
			goArch:                 args.GoArch,
			goArm:                  args.GoArm,
			packageType:            packageTypeDeb,
			packageArch:            args.DebArch,
			homeDir:                "/usr/share/grafana",
			homeBinDir:             "/usr/share/grafana/bin",
			binPath:                "/usr/sbin",
			configDir:              "/etc/grafana",
			etcDefaultPath:         "/etc/default",
			etcDefaultFilePath:     "/etc/default/grafana-server",
			initdScriptFilePath:    "/etc/init.d/grafana-server",
			systemdServiceFilePath: "/usr/lib/systemd/system/grafana-server.service",
			postinstSrc:            filepath.Join(grafanaDir, "packaging", "deb", "control", "postinst"),
			prermSrc:               filepath.Join(grafanaDir, "packaging", "deb", "control", "prerm"),
			initdScriptSrc:         filepath.Join(grafanaDir, "packaging", "deb", "init.d", "grafana-server"),
			defaultFileSrc:         filepath.Join(grafanaDir, "packaging", "deb", "default", "grafana-server"),
			systemdFileSrc:         filepath.Join(grafanaDir, "packaging", "deb", "systemd", "grafana-server.service"),
			wrapperFilePath:        filepath.Join(grafanaDir, "packaging", "wrappers"),
			depends:                []string{"adduser", "libfontconfig1"},
		}); err != nil {
			return err
		}
	}

	if !enableRpm {
		return nil
	}

	if args.RPMArch == "" {
		return fmt.Errorf("%w for %s", ErrorNoRPMArch, v)
	}

	if err := createPackage(tmpDir, linuxPackageOptions{
		edition:                edition,
		version:                version,
		grafanaDir:             grafanaDir,
		goArch:                 args.GoArch,
		packageType:            packageTypeRpm,
		packageArch:            args.RPMArch,
		homeDir:                "/usr/share/grafana",
		homeBinDir:             "/usr/share/grafana/bin",
		binPath:                "/usr/sbin",
		configDir:              "/etc/grafana",
		etcDefaultPath:         "/etc/sysconfig",
		etcDefaultFilePath:     "/etc/sysconfig/grafana-server",
		initdScriptFilePath:    "/etc/init.d/grafana-server",
		systemdServiceFilePath: "/usr/lib/systemd/system/grafana-server.service",
		postinstSrc:            filepath.Join(grafanaDir, "packaging", "rpm", "control", "postinst"),
		initdScriptSrc:         filepath.Join(grafanaDir, "packaging", "rpm", "init.d", "grafana-server"),
		defaultFileSrc:         filepath.Join(grafanaDir, "packaging", "rpm", "sysconfig", "grafana-server"),
		systemdFileSrc:         filepath.Join(grafanaDir, "packaging", "rpm", "systemd", "grafana-server.service"),
		wrapperFilePath:        filepath.Join(grafanaDir, "packaging", "wrappers"),
		depends:                []string{"/sbin/service", "fontconfig", "freetype", "urw-fonts"},
	}); err != nil {
		return err
	}

	return nil
}

// pluginManifest has details of an external plugin package.
type pluginManifest struct {
	Name     string `json:"name"`
	Version  string `json:"version"`
	Checksum string `json:"checksum"`
}

// pluginsManifest represents a manifest of Grafana's external plugins.
type pluginsManifest struct {
	Plugins []pluginManifest `json:"plugins"`
}

// packageVersion converts a Grafana version into the corresponding package version.
func packageVersion(options linuxPackageOptions) string {
	verComponents := strings.Split(options.version, "-")
	if len(verComponents) > 2 {
		panic(fmt.Sprintf("Version string contains more than one hyphen: %q", options.version))
	}

	switch options.packageType {
	case packageTypeDeb, packageTypeRpm:
		if len(verComponents) > 1 {
			// With Debian and RPM packages, it's customary to prefix any pre-release component with a ~, since this
			// is considered of lower lexical value than the empty character, and this way pre-release versions are
			// considered to be of a lower version than the final version (which lacks this suffix).
			return fmt.Sprintf("%s~%s", verComponents[0], verComponents[1])
		}

		return options.version
	default:
		panic(fmt.Sprintf("Unrecognized package type %s", options.packageType))
	}
}

type packageType int

func (pt packageType) String() string {
	switch pt {
	case packageTypeDeb:
		return "Debian"
	case packageTypeRpm:
		return "RPM"
	default:
		panic(fmt.Sprintf("Unrecognized package type %d", pt))
	}
}

const (
	packageTypeDeb packageType = iota
	packageTypeRpm
)

type linuxPackageOptions struct {
	edition                config.Edition
	packageType            packageType
	version                string
	grafanaDir             string
	goArch                 config.Architecture
	goArm                  string
	packageArch            config.Architecture
	homeDir                string
	homeBinDir             string
	binPath                string
	configDir              string
	etcDefaultPath         string
	etcDefaultFilePath     string
	initdScriptFilePath    string
	systemdServiceFilePath string
	postinstSrc            string
	prermSrc               string
	initdScriptSrc         string
	defaultFileSrc         string
	systemdFileSrc         string
	wrapperFilePath        string

	depends []string
}

// createArchive makes a distribution archive.
func createArchive(srcDir string, edition config.Edition, v config.Variant, version, grafanaDir string) error {
	distDir := filepath.Join(grafanaDir, "dist")
	exists, err := fs.Exists(distDir)
	if err != nil {
		return err
	}
	if !exists {
		log.Printf("directory %s doesn't exist - creating...", distDir)
		//nolint:gosec
		if err := os.MkdirAll(distDir, 0o755); err != nil {
			return fmt.Errorf("couldn't create dist: %w", err)
		}
	}
	sfx := ""
	if edition == config.EditionEnterprise2 {
		sfx = enterprise2Sfx
	} else if edition == config.EditionEnterprise {
		sfx = enterpriseSfx
	}
	if v != config.VariantWindowsAmd64 {
		return createTarball(srcDir, version, string(v), sfx, grafanaDir)
	}

	return createZip(srcDir, version, string(v), sfx, grafanaDir)
}

func createZip(srcDir, version, variantStr, sfx, grafanaDir string) error {
	fpath := filepath.Join(grafanaDir, "dist", fmt.Sprintf("grafana%s-%s.%s.zip", sfx, version, variantStr))
	//nolint:gosec
	tgt, err := os.Create(fpath)
	if err != nil {
		return fmt.Errorf("failed to create %q: %w", fpath, err)
	}
	defer func() {
		if err := tgt.Close(); err != nil && !errors.Is(err, os.ErrClosed) {
			log.Println(err)
		}
	}()

	//nolint:gosec
	if err := os.Chmod(fpath, 0664); err != nil {
		return fmt.Errorf("failed to set permissions on %q: %w", fpath, err)
	}
	zipWriter := zip.NewWriter(tgt)
	defer func() {
		if err := zipWriter.Close(); err != nil {
			log.Println(err)
		}
	}()

	for _, fname := range []string{"LICENSE", "README.md", "NOTICE.md"} {
		fpath := filepath.Join(grafanaDir, fname)
		fi, err := os.Lstat(fpath)
		if err != nil {
			return fmt.Errorf("couldn't stat %q: %w", fpath, err)
		}
		hdr, err := zip.FileInfoHeader(fi)
		if err != nil {
			return fmt.Errorf("failed to open zip header: %w", err)
		}
		// Enable compression, as it's disabled by default
		hdr.Method = zip.Deflate
		hdr.Name = fmt.Sprintf("grafana-%s/%s", version, fname)
		w, err := zipWriter.CreateHeader(hdr)
		if err != nil {
			return fmt.Errorf("failed writing zip header: %w", err)
		}
		//nolint:gosec
		src, err := os.Open(fpath)
		if err != nil {
			return fmt.Errorf("failed to open %q: %w", fname, err)
		}
		if _, err := io.Copy(w, src); err != nil {
			if err := src.Close(); err != nil {
				log.Println(err)
			}
			return fmt.Errorf("failed writing zip entry: %w", err)
		}
		if err := src.Close(); err != nil {
			log.Println(err)
		}
	}
	if err := filepath.Walk(srcDir, func(fpath string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if fpath == srcDir {
			return nil
		}

		hdr, err := zip.FileInfoHeader(fi)
		if err != nil {
			return fmt.Errorf("failed to open zip header: %s", err)
		}
		// Enable compression, as it's disabled by default
		hdr.Method = zip.Deflate
		hdr.Name = fmt.Sprintf("grafana-%s/%s", version, strings.TrimPrefix(fpath, fmt.Sprintf("%s/", srcDir)))
		if fi.IsDir() {
			// A trailing slash means it's a directory
			if hdr.Name[len(hdr.Name)-1] != '/' {
				hdr.Name += "/"
			}
		}
		w, err := zipWriter.CreateHeader(hdr)
		if err != nil {
			return fmt.Errorf("failed writing zip header: %s", err)
		}
		if fi.IsDir() {
			return nil
		}

		//nolint:gosec
		src, err := os.Open(fpath)
		if err != nil {
			return fmt.Errorf("failed to open %q: %w", fpath, err)
		}
		if _, err := io.Copy(w, src); err != nil {
			if err := src.Close(); err != nil {
				log.Println(err)
			}
			return fmt.Errorf("failed writing zip entry: %w", err)
		}
		if err := src.Close(); err != nil {
			log.Println(err)
		}
		return nil
	}); err != nil {
		return fmt.Errorf("failed to traverse directory %q: %w", srcDir, err)
	}

	if err := zipWriter.Close(); err != nil {
		return fmt.Errorf("failed writing %q: %w", fpath, err)
	}
	if err := tgt.Close(); err != nil {
		return fmt.Errorf("failed writing %q: %w", fpath, err)
	}

	log.Printf("Successfully created %q", fpath)
	return nil
}

// nolint
func createTarball(srcDir, version, variantStr, sfx, grafanaDir string) error {
	fpath := filepath.Join(grafanaDir, "dist", fmt.Sprintf("grafana%s-%s.%s.tar.gz", sfx, version, variantStr))
	//nolint:gosec
	tgt, err := os.Create(fpath)
	if err != nil {
		return fmt.Errorf("failed to create %q: %w", fpath, err)
	}
	defer func() {
		if err := tgt.Close(); err != nil && !errors.Is(err, os.ErrClosed) {
			log.Println(err)
		}
	}()

	//nolint:gosec
	if err := os.Chmod(fpath, 0664); err != nil {
		return fmt.Errorf("failed to set permissions on %q: %w", fpath, err)
	}
	gzWriter, err := gzip.NewWriterLevel(tgt, gzip.BestCompression)
	if err != nil {
		return fmt.Errorf("failed to create gzip writer: %w", err)
	}
	defer func() {
		if err := gzWriter.Close(); err != nil {
			log.Println(err)
		}
	}()
	tarWriter := tar.NewWriter(gzWriter)
	defer func() {
		if err := tarWriter.Close(); err != nil {
			log.Println(err)
		}
	}()

	for _, fname := range []string{"LICENSE", "README.md", "NOTICE.md"} {
		fpath := filepath.Join(grafanaDir, fname)
		fi, err := os.Lstat(fpath)
		if err != nil {
			return fmt.Errorf("couldn't stat %q: %w", fpath, err)
		}
		hdr, err := tar.FileInfoHeader(fi, "")
		if err != nil {
			return fmt.Errorf("failed getting tar header: %w", err)
		}
		hdr.Name = fmt.Sprintf("grafana-%s/%s", version, fname)
		if err := tarWriter.WriteHeader(hdr); err != nil {
			return fmt.Errorf("failed writing tar header: %w", err)
		}
		//nolint:gosec
		src, err := os.Open(fpath)
		if err != nil {
			return fmt.Errorf("failed to open %q: %w", fname, err)
		}
		if _, err := io.Copy(tarWriter, src); err != nil {
			if err := src.Close(); err != nil {
				log.Println(err)
			}
			return fmt.Errorf("failed writing tar entry: %w", err)
		}
		if err := src.Close(); err != nil {
			log.Println(err)
		}
	}
	if err := filepath.Walk(srcDir, func(fpath string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if fpath == srcDir {
			return nil
		}

		linkTgt := ""
		if fi.Mode()&os.ModeSymlink != 0 {
			log.Printf("reading link '%s'", fpath)
			linkTgt, err = os.Readlink(fpath)
			if err != nil {
				return err
			}
			linkTgt = fmt.Sprintf("grafana-%s/%s", version, linkTgt)
		}

		hdr, err := tar.FileInfoHeader(fi, linkTgt)
		if err != nil {
			return fmt.Errorf("failed getting tar header: %w", err)
		}
		hdr.Name = fmt.Sprintf("grafana-%s/%s", version, strings.TrimPrefix(fpath, fmt.Sprintf("%s/", srcDir)))
		if err := tarWriter.WriteHeader(hdr); err != nil {
			return fmt.Errorf("failed writing tar header: %w", err)
		}
		if fi.IsDir() {
			return nil
		}

		//nolint:gosec
		src, err := os.Open(fpath)
		if err != nil {
			return fmt.Errorf("failed to open %q: %w", fpath, err)
		}
		if _, err := io.Copy(tarWriter, src); err != nil {
			if err := src.Close(); err != nil {
				log.Println(err)
			}
			return fmt.Errorf("failed writing tar entry: %w", err)
		}
		if err := src.Close(); err != nil {
			log.Println(err)
		}

		return nil
	}); err != nil {
		return fmt.Errorf("failed to traverse directory %q: %w", srcDir, err)
	}

	if err := tarWriter.Close(); err != nil {
		return fmt.Errorf("failed writing %q: %w", fpath, err)
	}
	if err := gzWriter.Close(); err != nil {
		return fmt.Errorf("failed writing %q: %w", fpath, err)
	}
	if err := tgt.Close(); err != nil {
		return fmt.Errorf("failed writing %q: %w", fpath, err)
	}

	st, err := os.Stat(fpath)
	if err != nil {
		return err
	}
	perms := st.Mode() & os.ModePerm
	log.Printf("Successfully created package %q (permissions: %o)", fpath, perms)

	return nil
}
