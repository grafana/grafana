// +build ignore

package main

import (
	"bytes"
	"crypto/md5"
	"crypto/sha256"
	"encoding/json"
	"flag"
	"fmt"
	"go/build"
	"io"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

const (
	windows = "windows"
	linux   = "linux"
)

var (
	//versionRe = regexp.MustCompile(`-[0-9]{1,3}-g[0-9a-f]{5,10}`)
	goarch  string
	goos    string
	gocc    string
	cgo     bool
	libc    string
	pkgArch string
	version string = "v1"
	buildTags []string
	// deb & rpm does not support semver so have to handle their version a little differently
	linuxPackageVersion   string = "v1"
	linuxPackageIteration string = ""
	race                  bool
	workingDir            string
	includeBuildId        bool     = true
	buildId               string   = "0"
	serverBinary          string   = "grafana-server"
	cliBinary             string   = "grafana-cli"
	binaries              []string = []string{serverBinary, cliBinary}
	isDev                 bool     = false
	enterprise            bool     = false
	skipRpmGen            bool     = false
	skipDebGen            bool     = false
	printGenVersion       bool     = false
)

func main() {
	log.SetOutput(os.Stdout)
	log.SetFlags(0)

	var buildIdRaw string
	var buildTagsRaw string

	flag.StringVar(&goarch, "goarch", runtime.GOARCH, "GOARCH")
	flag.StringVar(&goos, "goos", runtime.GOOS, "GOOS")
	flag.StringVar(&gocc, "cc", "", "CC")
	flag.StringVar(&libc, "libc", "", "LIBC")
	flag.StringVar(&buildTagsRaw, "build-tags", "", "Sets custom build tags")
	flag.BoolVar(&cgo, "cgo-enabled", cgo, "Enable cgo")
	flag.StringVar(&pkgArch, "pkg-arch", "", "PKG ARCH")
	flag.BoolVar(&race, "race", race, "Use race detector")
	flag.BoolVar(&includeBuildId, "includeBuildId", includeBuildId, "IncludeBuildId in package name")
	flag.BoolVar(&enterprise, "enterprise", enterprise, "Build enterprise version of Grafana")
	flag.StringVar(&buildIdRaw, "buildId", "0", "Build ID from CI system")
	flag.BoolVar(&isDev, "dev", isDev, "optimal for development, skips certain steps")
	flag.BoolVar(&skipRpmGen, "skipRpm", skipRpmGen, "skip rpm package generation (default: false)")
	flag.BoolVar(&skipDebGen, "skipDeb", skipDebGen, "skip deb package generation (default: false)")
	flag.BoolVar(&printGenVersion, "gen-version", printGenVersion, "generate Grafana version and output (default: false)")
	flag.Parse()

	buildId = shortenBuildId(buildIdRaw)

	readVersionFromPackageJson()

	if pkgArch == "" {
		pkgArch = goarch
	}

	if printGenVersion {
		printGeneratedVersion()
		return
	}

	if len(buildTagsRaw) > 0 {
		buildTags = strings.Split(buildTagsRaw, ",")
	}

	log.Printf("Version: %s, Linux Version: %s, Package Iteration: %s\n", version, linuxPackageVersion, linuxPackageIteration)

	if flag.NArg() == 0 {
		log.Println("Usage: go run build.go build")
		return
	}

	workingDir, _ = os.Getwd()

	for _, cmd := range flag.Args() {
		switch cmd {
		case "setup":
			setup()

		case "build-srv", "build-server":
			clean()
			doBuild("grafana-server", "./pkg/cmd/grafana-server", buildTags)

		case "build-cli":
			clean()
			doBuild("grafana-cli", "./pkg/cmd/grafana-cli", buildTags)

		case "build":
			//clean()
			for _, binary := range binaries {
				doBuild(binary, "./pkg/cmd/"+binary, buildTags)
			}

		case "build-frontend":
			grunt(gruntBuildArg("build")...)

		case "test":
			test("./pkg/...")
			grunt("test")

		case "package":
			grunt(gruntBuildArg("build")...)
			grunt(gruntBuildArg("package")...)
			if goos == linux {
				createLinuxPackages()
			}

		case "package-only":
			grunt(gruntBuildArg("package")...)
			if goos == linux {
				createLinuxPackages()
			}
		case "pkg-archive":
			grunt(gruntBuildArg("package")...)

		case "pkg-rpm":
			grunt(gruntBuildArg("release")...)
			createRpmPackages()

		case "pkg-deb":
			grunt(gruntBuildArg("release")...)
			createDebPackages()

		case "sha-dist":
			shaFilesInDist()

		case "latest":
			makeLatestDistCopies()

		case "clean":
			clean()

		default:
			log.Fatalf("Unknown command %q", cmd)
		}
	}
}

func makeLatestDistCopies() {
	files, err := ioutil.ReadDir("dist")
	if err != nil {
		log.Fatalf("failed to create latest copies. Cannot read from /dist")
	}

	latestMapping := map[string]string{
		"_amd64.deb":               "dist/grafana_latest_amd64.deb",
		".x86_64.rpm":              "dist/grafana-latest-1.x86_64.rpm",
		".linux-amd64.tar.gz":      "dist/grafana-latest.linux-x64.tar.gz",
		".linux-amd64-musl.tar.gz": "dist/grafana-latest.linux-x64-musl.tar.gz",
		".linux-armv7.tar.gz":      "dist/grafana-latest.linux-armv7.tar.gz",
		".linux-armv7-musl.tar.gz": "dist/grafana-latest.linux-armv7-musl.tar.gz",
		".linux-armv6.tar.gz":      "dist/grafana-latest.linux-armv6.tar.gz",
		".linux-arm64.tar.gz":      "dist/grafana-latest.linux-arm64.tar.gz",
		".linux-arm64-musl.tar.gz": "dist/grafana-latest.linux-arm64-musl.tar.gz",
	}

	for _, file := range files {
		for extension, fullName := range latestMapping {
			if strings.HasSuffix(file.Name(), extension) {
				runError("cp", path.Join("dist", file.Name()), fullName)
			}
		}
	}
}

func readVersionFromPackageJson() {
	reader, err := os.Open("package.json")
	if err != nil {
		log.Fatal("Failed to open package.json")
		return
	}
	defer reader.Close()

	jsonObj := map[string]interface{}{}
	jsonParser := json.NewDecoder(reader)

	if err := jsonParser.Decode(&jsonObj); err != nil {
		log.Fatal("Failed to decode package.json")
	}

	version = jsonObj["version"].(string)
	linuxPackageVersion = version
	linuxPackageIteration = ""

	// handle pre version stuff (deb / rpm does not support semver)
	parts := strings.Split(version, "-")

	if len(parts) > 1 {
		linuxPackageVersion = parts[0]
		linuxPackageIteration = parts[1]
	}

	// add timestamp to iteration
	if includeBuildId {
		if buildId != "0" {
			linuxPackageIteration = fmt.Sprintf("%s%s", buildId, linuxPackageIteration)
		} else {
			linuxPackageIteration = fmt.Sprintf("%d%s", time.Now().Unix(), linuxPackageIteration)
		}
	}
}

type linuxPackageOptions struct {
	packageType            string
	packageArch            string
	homeDir                string
	homeBinDir             string
	binPath                string
	serverBinPath          string
	cliBinPath             string
	configDir              string
	ldapFilePath           string
	etcDefaultPath         string
	etcDefaultFilePath     string
	initdScriptFilePath    string
	systemdServiceFilePath string

	postinstSrc         string
	initdScriptSrc      string
	defaultFileSrc      string
	systemdFileSrc      string
	cliBinaryWrapperSrc string

	depends []string
}

func createDebPackages() {
	debPkgArch := pkgArch
	if pkgArch == "armv7" || pkgArch == "armv6" {
		debPkgArch = "armhf"
	}

	createPackage(linuxPackageOptions{
		packageType:            "deb",
		packageArch:            debPkgArch,
		homeDir:                "/usr/share/grafana",
		homeBinDir:             "/usr/share/grafana/bin",
		binPath:                "/usr/sbin",
		configDir:              "/etc/grafana",
		etcDefaultPath:         "/etc/default",
		etcDefaultFilePath:     "/etc/default/grafana-server",
		initdScriptFilePath:    "/etc/init.d/grafana-server",
		systemdServiceFilePath: "/usr/lib/systemd/system/grafana-server.service",

		postinstSrc:         "packaging/deb/control/postinst",
		initdScriptSrc:      "packaging/deb/init.d/grafana-server",
		defaultFileSrc:      "packaging/deb/default/grafana-server",
		systemdFileSrc:      "packaging/deb/systemd/grafana-server.service",
		cliBinaryWrapperSrc: "packaging/wrappers/grafana-cli",

		depends: []string{"adduser", "libfontconfig1"},
	})
}

func createRpmPackages() {
	rpmPkgArch := pkgArch
	switch {
	case pkgArch == "armv7":
		rpmPkgArch = "armhfp"
	case pkgArch == "arm64":
		rpmPkgArch = "aarch64"
	}
	createPackage(linuxPackageOptions{
		packageType:            "rpm",
		packageArch:            rpmPkgArch,
		homeDir:                "/usr/share/grafana",
		homeBinDir:             "/usr/share/grafana/bin",
		binPath:                "/usr/sbin",
		configDir:              "/etc/grafana",
		etcDefaultPath:         "/etc/sysconfig",
		etcDefaultFilePath:     "/etc/sysconfig/grafana-server",
		initdScriptFilePath:    "/etc/init.d/grafana-server",
		systemdServiceFilePath: "/usr/lib/systemd/system/grafana-server.service",

		postinstSrc:         "packaging/rpm/control/postinst",
		initdScriptSrc:      "packaging/rpm/init.d/grafana-server",
		defaultFileSrc:      "packaging/rpm/sysconfig/grafana-server",
		systemdFileSrc:      "packaging/rpm/systemd/grafana-server.service",
		cliBinaryWrapperSrc: "packaging/wrappers/grafana-cli",

		depends: []string{"/sbin/service", "fontconfig", "freetype", "urw-fonts"},
	})
}

func createLinuxPackages() {
	if !skipDebGen {
		createDebPackages()
	}

	if !skipRpmGen {
		createRpmPackages()
	}
}

func createPackage(options linuxPackageOptions) {
	packageRoot, _ := ioutil.TempDir("", "grafana-linux-pack")

	// create directories
	runPrint("mkdir", "-p", filepath.Join(packageRoot, options.homeDir))
	runPrint("mkdir", "-p", filepath.Join(packageRoot, options.configDir))
	runPrint("mkdir", "-p", filepath.Join(packageRoot, "/etc/init.d"))
	runPrint("mkdir", "-p", filepath.Join(packageRoot, options.etcDefaultPath))
	runPrint("mkdir", "-p", filepath.Join(packageRoot, "/usr/lib/systemd/system"))
	runPrint("mkdir", "-p", filepath.Join(packageRoot, "/usr/sbin"))

	// copy grafana-cli wrapper
	runPrint("cp", "-p", options.cliBinaryWrapperSrc, filepath.Join(packageRoot, "/usr/sbin/"+cliBinary))

	// copy grafana-server binary
	runPrint("cp", "-p", filepath.Join(workingDir, "tmp/bin/"+serverBinary), filepath.Join(packageRoot, "/usr/sbin/"+serverBinary))

	// copy init.d script
	runPrint("cp", "-p", options.initdScriptSrc, filepath.Join(packageRoot, options.initdScriptFilePath))
	// copy environment var file
	runPrint("cp", "-p", options.defaultFileSrc, filepath.Join(packageRoot, options.etcDefaultFilePath))
	// copy systemd file
	runPrint("cp", "-p", options.systemdFileSrc, filepath.Join(packageRoot, options.systemdServiceFilePath))
	// copy release files
	runPrint("cp", "-a", filepath.Join(workingDir, "tmp")+"/.", filepath.Join(packageRoot, options.homeDir))
	// remove bin path
	runPrint("rm", "-rf", filepath.Join(packageRoot, options.homeDir, "bin"))

	// create /bin within home
	runPrint("mkdir", "-p", filepath.Join(packageRoot, options.homeBinDir))
	// The grafana-cli binary is exposed through a wrapper to ensure a proper
	// configuration is in place. To enable that, we need to store the original
	// binary in a separate location to avoid conflicts.
	runPrint("cp", "-p", filepath.Join(workingDir, "tmp/bin/"+cliBinary), filepath.Join(packageRoot, options.homeBinDir, cliBinary))

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

		"--version", linuxPackageVersion,
		"-p", "./dist",
	}

	name := "grafana"
	if enterprise {
		name += "-enterprise"
		args = append(args, "--replaces", "grafana")
	}
	fmt.Printf("pkgArch is set to '%s', generated arch is '%s'\n", pkgArch, options.packageArch)
	if pkgArch == "armv6" {
		name += "-rpi"
		args = append(args, "--replaces", "grafana")
	}
	args = append(args, "--name", name)

	description := "Grafana"
	if enterprise {
		description += " Enterprise"
	}

	if !enterprise {
		args = append(args, "--license", "\"Apache 2.0\"")
	}

	if options.packageType == "rpm" {
		args = append(args, "--rpm-posttrans", "packaging/rpm/control/posttrans")
	}

	if options.packageType == "deb" {
		args = append(args, "--deb-no-default-config-files")
	}

	if options.packageArch != "" {
		args = append(args, "-a", options.packageArch)
	}

	if linuxPackageIteration != "" {
		args = append(args, "--iteration", linuxPackageIteration)
	}

	// add dependencies
	for _, dep := range options.depends {
		args = append(args, "--depends", dep)
	}

	args = append(args, ".")

	fmt.Println("Creating package: ", options.packageType)
	runPrint("fpm", append([]string{"-t", options.packageType}, args...)...)
}

func grunt(params ...string) {
	if runtime.GOOS == windows {
		runPrint(`.\node_modules\.bin\grunt`, params...)
	} else {
		runPrint("./node_modules/.bin/grunt", params...)
	}
}

func genPackageVersion() string {
	if includeBuildId {
		return fmt.Sprintf("%v-%v", linuxPackageVersion, linuxPackageIteration)
	} else {
		return version
	}
}

func gruntBuildArg(task string) []string {
	args := []string{task}
	args = append(args, fmt.Sprintf("--pkgVer=%v", genPackageVersion()))
	if pkgArch != "" {
		args = append(args, fmt.Sprintf("--arch=%v", pkgArch))
	}
	if libc != "" {
		args = append(args, fmt.Sprintf("--libc=%s", libc))
	}
	if enterprise {
		args = append(args, "--enterprise")
	}

	args = append(args, fmt.Sprintf("--platform=%v", goos))

	return args
}

func setup() {
	runPrint("go", "install", "-v", "./pkg/cmd/grafana-server")
}

func printGeneratedVersion() {
	fmt.Print(genPackageVersion())
}

func test(pkg string) {
	setBuildEnv()
	runPrint("go", "test", "-short", "-timeout", "60s", pkg)
}

func doBuild(binaryName, pkg string, tags []string) {
	libcPart := ""
	if libc != "" {
		libcPart = fmt.Sprintf("-%s", libc)
	}
	binary := fmt.Sprintf("./bin/%s-%s%s/%s", goos, goarch, libcPart, binaryName)
	if isDev {
		//don't include os/arch/libc in output path in dev environment
		binary = fmt.Sprintf("./bin/%s", binaryName)
	}

	if goos == windows {
		binary += ".exe"
	}

	if !isDev {
		rmr(binary, binary+".md5")
	}
	args := []string{"build", "-ldflags", ldflags()}
	if len(tags) > 0 {
		args = append(args, "-tags", strings.Join(tags, ","))
	}
	if race {
		args = append(args, "-race")
	}

	args = append(args, "-o", binary)
	args = append(args, pkg)

	if !isDev {
		setBuildEnv()
		runPrint("go", "version")
		libcPart := ""
		if libc != "" {
			libcPart = fmt.Sprintf("/%s", libc)
		}
		fmt.Printf("Targeting %s/%s%s\n", goos, goarch, libcPart)
	}

	runPrint("go", args...)

	if !isDev {
		// Create an md5 checksum of the binary, to be included in the archive for
		// automatic upgrades.
		err := md5File(binary)
		if err != nil {
			log.Fatal(err)
		}
	}
}

func ldflags() string {
	var b bytes.Buffer
	b.WriteString("-w")
	b.WriteString(fmt.Sprintf(" -X main.version=%s", version))
	b.WriteString(fmt.Sprintf(" -X main.commit=%s", getGitSha()))
	b.WriteString(fmt.Sprintf(" -X main.buildstamp=%d", buildStamp()))
	b.WriteString(fmt.Sprintf(" -X main.buildBranch=%s", getGitBranch()))
	if v := os.Getenv("LDFLAGS"); v != "" {
		b.WriteString(fmt.Sprintf(" -extldflags \"%s\"", v))
	}
	return b.String()
}

func rmr(paths ...string) {
	for _, path := range paths {
		log.Println("rm -r", path)
		os.RemoveAll(path)
	}
}

func clean() {
	if isDev {
		return
	}

	rmr("dist")
	rmr("tmp")
	rmr(filepath.Join(build.Default.GOPATH, fmt.Sprintf("pkg/%s_%s/github.com/grafana", goos, goarch)))
}

func setBuildEnv() {
	os.Setenv("GOOS", goos)
	if goos == windows {
		// require windows >=7
		os.Setenv("CGO_CFLAGS", "-D_WIN32_WINNT=0x0601")
	}
	if goarch != "amd64" || goos != linux {
		// needed for all other archs
		cgo = true
	}
	if strings.HasPrefix(goarch, "armv") {
		os.Setenv("GOARCH", "arm")
		os.Setenv("GOARM", goarch[4:])
	} else {
		os.Setenv("GOARCH", goarch)
	}
	if goarch == "386" {
		os.Setenv("GO386", "387")
	}
	if cgo {
		os.Setenv("CGO_ENABLED", "1")
	}
	if gocc != "" {
		os.Setenv("CC", gocc)
	}
}

func getGitBranch() string {
	v, err := runError("git", "rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return "master"
	}
	return string(v)
}

func getGitSha() string {
	v, err := runError("git", "rev-parse", "--short", "HEAD")
	if err != nil {
		return "unknown-dev"
	}
	return string(v)
}

func buildStamp() int64 {
	// use SOURCE_DATE_EPOCH if set.
	if s, _ := strconv.ParseInt(os.Getenv("SOURCE_DATE_EPOCH"), 10, 64); s > 0 {
		return s
	}

	bs, err := runError("git", "show", "-s", "--format=%ct")
	if err != nil {
		return time.Now().Unix()
	}
	s, _ := strconv.ParseInt(string(bs), 10, 64)
	return s
}

func runError(cmd string, args ...string) ([]byte, error) {
	ecmd := exec.Command(cmd, args...)
	bs, err := ecmd.CombinedOutput()
	if err != nil {
		return nil, err
	}

	return bytes.TrimSpace(bs), nil
}

func runPrint(cmd string, args ...string) {
	log.Println(cmd, strings.Join(args, " "))
	ecmd := exec.Command(cmd, args...)
	ecmd.Env = append(os.Environ(), "GO111MODULE=on")
	ecmd.Stdout = os.Stdout
	ecmd.Stderr = os.Stderr
	err := ecmd.Run()
	if err != nil {
		log.Fatal(err)
	}
}

func md5File(file string) error {
	fd, err := os.Open(file)
	if err != nil {
		return err
	}
	defer fd.Close()

	h := md5.New()
	_, err = io.Copy(h, fd)
	if err != nil {
		return err
	}

	out, err := os.Create(file + ".md5")
	if err != nil {
		return err
	}

	_, err = fmt.Fprintf(out, "%x\n", h.Sum(nil))
	if err != nil {
		return err
	}

	return out.Close()
}

func shaFilesInDist() {
	filepath.Walk("./dist", func(path string, f os.FileInfo, err error) error {
		if path == "./dist" {
			return nil
		}

		if !strings.Contains(path, ".sha256") {
			err := shaFile(path)
			if err != nil {
				log.Printf("Failed to create sha file. error: %v\n", err)
			}
		}
		return nil
	})
}

func shaFile(file string) error {
	fd, err := os.Open(file)
	if err != nil {
		return err
	}
	defer fd.Close()

	h := sha256.New()
	_, err = io.Copy(h, fd)
	if err != nil {
		return err
	}

	out, err := os.Create(file + ".sha256")
	if err != nil {
		return err
	}

	_, err = fmt.Fprintf(out, "%x\n", h.Sum(nil))
	if err != nil {
		return err
	}

	return out.Close()
}

func shortenBuildId(buildId string) string {
	buildId = strings.Replace(buildId, "-", "", -1)
	if len(buildId) < 9 {
		return buildId
	}
	return buildId[0:8]
}
