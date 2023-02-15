package grafana

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/cryptoutil"
	"github.com/grafana/grafana/pkg/build/golangutils"
)

var binaries = []string{"grafana", "grafana-server", "grafana-cli"}

const (
	SuffixEnterprise2 = "-enterprise2"
)

const (
	ExtensionExe = ".exe"
)

func GrafanaLDFlags(version string, r config.Revision) []string {
	return []string{
		"-w",
		fmt.Sprintf("-X main.version=%s", version),
		fmt.Sprintf("-X main.commit=%s", r.SHA256),
		fmt.Sprintf("-X main.buildstamp=%d", r.Timestamp),
		fmt.Sprintf("-X main.buildBranch=%s", r.Branch),
	}
}

// BinaryFolder returns the path to where the Grafana binary is build given the provided arguments.
func BinaryFolder(edition config.Edition, args BuildArgs) string {
	sfx := ""
	if edition == config.EditionEnterprise2 {
		sfx = SuffixEnterprise2
	}

	arch := string(args.GoArch)
	if args.GoArch == config.ArchARM {
		arch = string(args.GoArch) + "v" + args.GoArm
	}

	format := fmt.Sprintf("%s-%s", args.GoOS, arch)
	if args.LibC != "" {
		format += fmt.Sprintf("-%s", args.LibC)
	}
	format += sfx

	if args.GoOS == config.OSWindows {
		format += ExtensionExe
	}

	return format
}

func GrafanaDescriptor(opts golangutils.BuildOpts) string {
	libcPart := ""
	if opts.LibC != "" {
		libcPart = fmt.Sprintf("/%s", opts.LibC)
	}
	arch := string(opts.GoArch)
	if opts.GoArch == config.ArchARM {
		arch = string(opts.GoArch) + "v" + opts.GoArm
	}

	return fmt.Sprintf("%s/%s%s", opts.GoOS, arch, libcPart)
}

// BuildGrafanaBinary builds a certain binary according to certain parameters.
func BuildGrafanaBinary(ctx context.Context, name, version string, args BuildArgs, edition config.Edition) error {
	opts := args.BuildOpts
	opts.ExtraEnv = os.Environ()

	revision, err := config.GrafanaRevision(ctx, opts.Workdir)
	if err != nil {
		return err
	}

	folder := BinaryFolder(edition, args)

	if opts.GoOS == config.OSWindows {
		name += ExtensionExe
	}

	binary := filepath.Join(opts.Workdir, "bin", folder, name)
	opts.Output = binary

	if err := os.RemoveAll(binary); err != nil {
		return fmt.Errorf("failed to remove %q: %w", binary, err)
	}

	if err := os.RemoveAll(binary + ".md5"); err != nil {
		return fmt.Errorf("failed to remove %q: %w", binary+".md5", err)
	}

	descriptor := GrafanaDescriptor(opts)

	log.Printf("Building %q for %s", binary, descriptor)

	opts.LdFlags = append(args.LdFlags, GrafanaLDFlags(version, revision)...)

	if edition == config.EditionEnterprise2 {
		opts.ExtraArgs = []string{"-tags=pro"}
	}

	log.Printf("Running command 'go %s'", opts.Args())

	if err := golangutils.RunBuild(ctx, opts); err != nil {
		return err
	}

	// Create an MD5 checksum of the binary, to be included in the archive for
	// automatic upgrades.
	if err := cryptoutil.MD5File(binary); err != nil {
		return err
	}

	return nil
}
