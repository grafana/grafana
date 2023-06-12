package grafana

import (
	"bytes"
	"context"
	"fmt"
	"path/filepath"

	"github.com/grafana/grafana/pkg/build/compilers"
	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/golangutils"
)

// BuildArgs represent the build parameters that define the "go build" behavior of a single variant.
// These arguments are applied as environment variables and arguments to the "go build" command.
type BuildArgs struct {
	golangutils.BuildOpts
	DebArch config.Architecture
	RPMArch config.Architecture
}

type BuildVariantOpts struct {
	Variant config.Variant
	Edition config.Edition

	Version    string
	GrafanaDir string
}

// BuildVariant builds a certain variant of the grafana-server and grafana-cli binaries sequentially.
func BuildVariant(ctx context.Context, opts BuildVariantOpts) error {
	grafanaDir, err := filepath.Abs(opts.GrafanaDir)
	if err != nil {
		return err
	}

	var (
		args = VariantBuildArgs(opts.Variant)
	)

	for _, binary := range binaries {
		// Note that for Golang cmd paths we must use the relative path and the Linux file separators (/) even for Windows users.
		var (
			pkg    = fmt.Sprintf("./pkg/cmd/%s", binary)
			stdout = bytes.NewBuffer(nil)
			stderr = bytes.NewBuffer(nil)
		)

		args.Workdir = grafanaDir
		args.Stdout = stdout
		args.Stderr = stderr
		args.Package = pkg

		if err := BuildGrafanaBinary(ctx, binary, opts.Version, args, opts.Edition); err != nil {
			return fmt.Errorf("failed to build %s for %s: %w\nstdout: %s\nstderr: %s", pkg, opts.Variant, err, stdout.String(), stderr.String())
		}
	}

	return nil
}

var ldFlagsStatic = []string{"-linkmode=external", "-extldflags=-static"}

var variantArgs = map[config.Variant]BuildArgs{
	config.VariantArmV6: {
		BuildOpts: golangutils.BuildOpts{
			GoOS:       config.OSLinux,
			CGoEnabled: true,
			GoArch:     config.ArchARM,
			GoArm:      "6",
			CC:         compilers.ArmV6,
		},
		DebArch: config.ArchARMHF,
	},
	config.VariantArmV7: {
		BuildOpts: golangutils.BuildOpts{
			GoOS:       config.OSLinux,
			CGoEnabled: true,
			GoArch:     config.ArchARM,
			GoArm:      "7",
			CC:         compilers.Armv7,
		},
		DebArch: config.ArchARMHF,
		RPMArch: config.ArchARMHFP,
	},
	config.VariantArmV7Musl: {
		BuildOpts: golangutils.BuildOpts{
			GoOS:       config.OSLinux,
			CGoEnabled: true,
			GoArch:     config.ArchARM,
			GoArm:      "7",
			LibC:       config.LibCMusl,
			CC:         compilers.Armv7Musl,
			LdFlags:    ldFlagsStatic,
		},
	},
	config.VariantArm64: {
		BuildOpts: golangutils.BuildOpts{
			GoOS:       config.OSLinux,
			CGoEnabled: true,
			GoArch:     config.ArchARM64,
			CC:         compilers.Arm64,
		},
		DebArch: config.ArchARM64,
		RPMArch: "aarch64",
	},
	config.VariantArm64Musl: {
		BuildOpts: golangutils.BuildOpts{
			GoOS:       config.OSLinux,
			GoArch:     config.ArchARM64,
			CGoEnabled: true,
			CC:         compilers.Arm64Musl,
			LibC:       config.LibCMusl,
			LdFlags:    ldFlagsStatic,
		},
	},
	config.VariantDarwinAmd64: {
		BuildOpts: golangutils.BuildOpts{
			GoOS:       config.OSDarwin,
			CGoEnabled: true,
			GoArch:     config.ArchAMD64,
			CC:         compilers.Osx64,
		},
	},
	config.VariantWindowsAmd64: {
		BuildOpts: golangutils.BuildOpts{
			GoOS:       config.OSWindows,
			GoArch:     config.ArchAMD64,
			CC:         compilers.Win64,
			CGoEnabled: true,
			CGoCFlags:  "-D_WIN32_WINNT=0x0601",
		},
	},
	config.VariantLinuxAmd64: {
		BuildOpts: golangutils.BuildOpts{
			GoOS:   config.OSLinux,
			GoArch: config.ArchAMD64,
			CC:     compilers.LinuxX64,
		},
		DebArch: config.ArchAMD64,
		RPMArch: config.ArchAMD64,
	},
	config.VariantLinuxAmd64Musl: {
		BuildOpts: golangutils.BuildOpts{
			GoOS:    config.OSLinux,
			GoArch:  config.ArchAMD64,
			CC:      compilers.LinuxX64Musl,
			LibC:    config.LibCMusl,
			LdFlags: ldFlagsStatic,
		},
	},
}

func VariantBuildArgs(v config.Variant) BuildArgs {
	if val, ok := variantArgs[v]; ok {
		return val
	}

	return BuildArgs{}
}
