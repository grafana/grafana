package backend

import (
	"fmt"
	"log/slog"
	"strings"

	"dagger.io/dagger"
)

// Distribution is a string that represents the GOOS and GOARCH environment variables joined by a "/".
// Optionally, if there is an extra argument specific to that architecture, it will be the last segment of the string.
// Examples:
// - "linux/arm/v6" = GOOS=linux, GOARCH=arm, GOARM=6
// - "linux/arm/v7" = GOOS=linux, GOARCH=arm, GOARM=7
// - "linux/amd64/v7" = GOOS=linux, GOARCH=arm, GOARM=7
// - "linux/amd64/v2" = GOOS=linux, GOARCH=amd64, GOAMD64=v2
// The list of distributions is built from the command "go tool dist list".
// While not all are used, it at least represents the possible combinations.
type Distribution string

const (
	DistDarwinAMD64   Distribution = "darwin/amd64"
	DistDarwinAMD64v1 Distribution = "darwin/amd64/v1"
	DistDarwinAMD64v2 Distribution = "darwin/amd64/v2"
	DistDarwinAMD64v3 Distribution = "darwin/amd64/v3"
	DistDarwinAMD64v4 Distribution = "darwin/amd64/v4"
	DistDarwinARM64   Distribution = "darwin/arm64"
)

const (
	DistFreeBSD386          Distribution = "freebsd/386"
	DistFreeBSD386SSE2      Distribution = "freebsd/386/sse2"
	DistFreeBSD386SoftFloat Distribution = "freebsd/386/softfloat"
	DistFreeBSDAMD64        Distribution = "freebsd/amd64"
	DistFreeBSDAMD64v1      Distribution = "freebsd/amd64/v1"
	DistFreeBSDAMD64v2      Distribution = "freebsd/amd64/v2"
	DistFreeBSDAMD64v3      Distribution = "freebsd/amd64/v3"
	DistFreeBSDAMD64v4      Distribution = "freebsd/amd64/v4"
	DistFreeBSDARM          Distribution = "freebsd/arm"
	DistFreeBSDARM64        Distribution = "freebsd/arm64"
	DistFreeBSDRISCV        Distribution = "freebsd/riscv64"
)

const (
	DistIllumosAMD64   Distribution = "illumos/amd64"
	DistIllumosAMD64v1 Distribution = "illumos/amd64/v1"
	DistIllumosAMD64v2 Distribution = "illumos/amd64/v2"
	DistIllumosAMD64v3 Distribution = "illumos/amd64/v3"
	DistIllumosAMD64v4 Distribution = "illumos/amd64/v4"
)
const (
	DistLinux386              Distribution = "linux/386"
	DistLinux386SSE2          Distribution = "linux/386/sse2"
	DistLinux386SoftFloat     Distribution = "linux/386/softfloat"
	DistLinuxAMD64            Distribution = "linux/amd64"
	DistLinuxAMD64v1          Distribution = "linux/amd64/v1"
	DistLinuxAMD64v2          Distribution = "linux/amd64/v2"
	DistLinuxAMD64v3          Distribution = "linux/amd64/v3"
	DistLinuxAMD64v4          Distribution = "linux/amd64/v4"
	DistLinuxAMD64Dynamic     Distribution = "linux/amd64/dynamic"
	DistLinuxAMD64DynamicMusl Distribution = "linux/amd64/dynamic-musl"
	DistLinuxARM              Distribution = "linux/arm"
	DistLinuxARMv6            Distribution = "linux/arm/v6"
	DistLinuxARMv7            Distribution = "linux/arm/v7"
	DistLinuxARM64            Distribution = "linux/arm64"
	DistLinuxARM64Dynamic     Distribution = "linux/arm64/dynamic"
	DistLinuxLoong64          Distribution = "linux/loong64"
	DistLinuxMips             Distribution = "linux/mips"
	DistLinuxMips64           Distribution = "linux/mips64"
	DistLinuxMips64le         Distribution = "linux/mips64le"
	DistLinuxMipsle           Distribution = "linux/mipsle"
	DistLinuxPPC64            Distribution = "linux/ppc64"
	DistLinuxPPC64le          Distribution = "linux/ppc64le"
	DistLinuxRISCV64          Distribution = "linux/riscv64"
	DistLinuxS390X            Distribution = "linux/s390x"
)

const (
	DistOpenBSD386          Distribution = "openbsd/386"
	DistOpenBSD386SSE2      Distribution = "openbsd/386/sse2"
	DistOpenBSD386SoftFLoat Distribution = "openbsd/386/softfloat"
	DistOpenBSDAMD64        Distribution = "openbsd/amd64"
	DistOpenBSDAMD64v1      Distribution = "openbsd/amd64/v1"
	DistOpenBSDAMD64v2      Distribution = "openbsd/amd64/v2"
	DistOpenBSDAMD64v3      Distribution = "openbsd/amd64/v3"
	DistOpenBSDAMD64v4      Distribution = "openbsd/amd64/v4"
	DistOpenBSDARM          Distribution = "openbsd/arm"
	DistOpenBSDARMv6        Distribution = "openbsd/arm/v6"
	DistOpenBSDARMv7        Distribution = "openbsd/arm/v7"
	DistOpenBSDARM64        Distribution = "openbsd/arm64"
	DistOpenBSDMips64       Distribution = "openbsd/mips64"
)

const (
	DistPlan9386          Distribution = "plan9/386"
	DistPlan9386SSE2      Distribution = "plan9/386/sse2"
	DistPlan9386SoftFloat Distribution = "plan9/386/softfloat"
	DistPlan9AMD64        Distribution = "plan9/amd64"
	DistPlan9AMD64v1      Distribution = "plan9/amd64/v1"
	DistPlan9AMD64v2      Distribution = "plan9/amd64/v2"
	DistPlan9AMD64v3      Distribution = "plan9/amd64/v3"
	DistPlan9AMD64v4      Distribution = "plan9/amd64/v4"
	DistPlan9ARM          Distribution = "plan9/arm/v6"
	DistPlan9ARMv6        Distribution = "plan9/arm/v6"
	DistPlan9ARMv7        Distribution = "plan9/arm/v7"
)

const (
	DistSolarisAMD64   Distribution = "solaris/amd64"
	DistSolarisAMD64v1 Distribution = "solaris/amd64/v1"
	DistSolarisAMD64v2 Distribution = "solaris/amd64/v2"
	DistSolarisAMD64v3 Distribution = "solaris/amd64/v3"
	DistSolarisAMD64v4 Distribution = "solaris/amd64/v4"
)

const (
	DistWindows386          Distribution = "windows/386"
	DistWindows386SSE2      Distribution = "windows/386/sse2"
	DistWindows386SoftFloat Distribution = "windows/386/softfloat"
	DistWindowsAMD64        Distribution = "windows/amd64"
	DistWindowsAMD64v1      Distribution = "windows/amd64/v1"
	DistWindowsAMD64v2      Distribution = "windows/amd64/v2"
	DistWindowsAMD64v3      Distribution = "windows/amd64/v3"
	DistWindowsAMD64v4      Distribution = "windows/amd64/v4"
	DistWindowsARM          Distribution = "windows/arm"
	DistWindowsARMv6        Distribution = "windows/arm/v6"
	DistWindowsARMv7        Distribution = "windows/arm/v7"
	DistWindowsARM64        Distribution = "windows/arm64"
)

func IsWindows(d Distribution) bool {
	return strings.Split(string(d), "/")[0] == "windows"
}

func OSAndArch(d Distribution) (string, string) {
	p := strings.Split(string(d), "/")
	if len(p) < 2 {
		return string(d), ""
	}
	return p[0], p[1]
}

func FullArch(d Distribution) string {
	p := strings.Split(string(d), "/")
	return strings.Join(p[1:], "/")
}

func ArchVersion(d Distribution) string {
	p := strings.Split(string(d), "/")
	if len(p) < 3 {
		return ""
	}

	// ARM specifically must be specified without a 'v' prefix.
	// GOAMD64, however, expects a 'v' prefix.
	// Specifying the ARM version with the 'v' prefix and without is supported in Docker's platform argument, however.
	if arch := p[1]; arch == "arm" {
		return strings.TrimPrefix(p[2], "v")
	}

	return p[2]
}

func PackageArch(d Distribution) string {
	_, arch := OSAndArch(d)

	if arch == "arm" {
		return "armhf"
	}

	return arch
}

// From the distribution, try to assume the docker platform (used in Docker's --platform argument or the (dagger.ContainerOpts).Platform field
func Platform(d Distribution) dagger.Platform {
	p := strings.ReplaceAll(string(d), "/dynamic-musl", "")
	p = strings.ReplaceAll(p, "/dynamic", "")
	p = strings.ReplaceAll(p, "arm/v6", "arm/v7")
	// for now let's just try to use the distro name as the platform and see if that works...
	return dagger.Platform(p)
}

type DistroBuildOptsFunc func(distro Distribution, experiments []string, tags []string) *GoBuildOpts

func LDFlagsStatic(info *VCSInfo) []LDFlag {
	return []LDFlag{
		{"-w", nil},
		{"-s", nil},
		{"-X", info.X()},
		{"-linkmode=external", nil},
		{"-extldflags=-static", nil},
	}
}

func LDFlagsDynamic(info *VCSInfo) []LDFlag {
	return []LDFlag{
		{"-X", info.X()},
	}
}

func ZigCC(distro Distribution) string {
	target, ok := ZigTargets[distro]
	if !ok {
		target = "x86_64-linux-musl" // best guess? should probably retun an error but i don't want to
	}

	return fmt.Sprintf("zig cc -target %s", target)
}

func ZigCXX(distro Distribution) string {
	target, ok := ZigTargets[distro]
	if !ok {
		target = "x86_64-linux-musl" // best guess? should probably retun an error but i don't want to
	}

	return fmt.Sprintf("zig c++ -target %s", target)
}

var DefaultBuildOpts = func(distro Distribution, experiments []string, tags []string) *GoBuildOpts {
	os, arch := OSAndArch(distro)

	return &GoBuildOpts{
		CC:                ZigCC(distro),
		CXX:               ZigCXX(distro),
		ExperimentalFlags: experiments,
		OS:                os,
		Arch:              arch,
		CGOEnabled:        true,
	}
}

// BuildOptsStaticARM builds Grafana statically for the armv6/v7 architectures (not aarch64/arm64)
func BuildOptsStaticARM(distro Distribution, experiments []string, tags []string) *GoBuildOpts {
	var (
		os, _ = OSAndArch(distro)
		arm   = ArchVersion(distro)
	)

	return &GoBuildOpts{
		CC:                "/toolchain/arm-linux-musleabihf-cross/bin/arm-linux-musleabihf-gcc",
		CXX:               "/toolchain/arm-linux-musleabihf-cross/bin/arm-linux-musleabihf-cpp",
		ExperimentalFlags: experiments,
		OS:                os,
		Arch:              "arm",
		GoARM:             GoARM(arm),
		CGOEnabled:        true,
	}
}

// BuildOptsStaticS390X builds Grafana statically for the s390x arch
func BuildOptsStaticS390X(distro Distribution, experiments []string, tags []string) *GoBuildOpts {
	var (
		os, _ = OSAndArch(distro)
	)

	return &GoBuildOpts{
		CC:                "/toolchain/s390x-linux-musl-cross/bin/s390x-linux-musl-gcc",
		CXX:               "/toolchain/s390x-linux-musl-cross/bin/s390x-linux-musl-cpp",
		ExperimentalFlags: experiments,
		OS:                os,
		Arch:              "s390x",
		CGOEnabled:        true,
	}
}

func StdZigBuildOpts(distro Distribution, experiments []string, tags []string) *GoBuildOpts {
	var (
		os, arch = OSAndArch(distro)
	)

	return &GoBuildOpts{
		CC:                ZigCC(distro),
		CXX:               ZigCXX(distro),
		ExperimentalFlags: experiments,
		OS:                os,
		Arch:              arch,
		CGOEnabled:        true,
	}
}

func BuildOptsWithoutZig(distro Distribution, experiments []string, tags []string) *GoBuildOpts {
	var (
		os, arch = OSAndArch(distro)
	)

	return &GoBuildOpts{
		ExperimentalFlags: experiments,
		OS:                os,
		Arch:              arch,
		CGOEnabled:        true,
	}
}

func ViceroyBuildOpts(distro Distribution, experiments []string, tags []string) *GoBuildOpts {
	var (
		os, arch = OSAndArch(distro)
	)

	return &GoBuildOpts{
		CC:                "viceroycc",
		ExperimentalFlags: experiments,
		OS:                os,
		Arch:              arch,
		CGOEnabled:        true,
	}
}

var ZigTargets = map[Distribution]string{
	DistLinuxAMD64:            "x86_64-linux-musl",
	DistLinuxAMD64Dynamic:     "x86_64-linux-gnu",
	DistLinuxAMD64DynamicMusl: "x86_64-linux-musl",
	DistLinuxARM64:            "aarch64-linux-musl",
	DistLinuxARM64Dynamic:     "aarch64-linux-musl",
	DistLinuxARM:              "arm-linux-musleabihf",
	DistLinuxARMv6:            "arm-linux-musleabihf",
	DistLinuxARMv7:            "arm-linux-musleabihf",
	DistLinuxRISCV64:          "riscv64-linux-musl",
	DistWindowsAMD64:          "x86_64-windows-gnu",
	DistWindowsARM64:          "aarch64-windows-gnu",
}

var DistributionGoOpts = map[Distribution]DistroBuildOptsFunc{
	// The Linux distros should all have an equivalent zig target in the ZigTargets map
	DistLinuxARM:          BuildOptsStaticARM,
	DistLinuxARMv6:        BuildOptsStaticARM,
	DistLinuxARMv7:        BuildOptsStaticARM,
	DistLinuxS390X:        BuildOptsStaticS390X,
	DistLinuxARM64:        StdZigBuildOpts,
	DistLinuxARM64Dynamic: StdZigBuildOpts,
	DistLinuxAMD64:        StdZigBuildOpts,
	DistLinuxAMD64Dynamic: StdZigBuildOpts,
	DistPlan9AMD64:        StdZigBuildOpts,
	DistLinuxRISCV64:      StdZigBuildOpts,

	// Non-Linux distros can have whatever they want in CC and CXX; it'll get overridden
	// but it's probably not best to rely on that.
	DistWindowsAMD64: ViceroyBuildOpts,
	DistWindowsARM64: StdZigBuildOpts,
	DistDarwinAMD64:  ViceroyBuildOpts,
	DistDarwinARM64:  ViceroyBuildOpts,

	DistLinuxAMD64DynamicMusl: BuildOptsWithoutZig,
}

func DistroOptsLogger(log *slog.Logger, fn DistroBuildOptsFunc) func(distro Distribution, experiments []string, tags []string) *GoBuildOpts {
	return func(distro Distribution, experiments []string, tags []string) *GoBuildOpts {
		opts := fn(distro, experiments, tags)
		log.Debug("Building with options", "distribution", distro, "experiments", experiments, "tags", tags, "os", opts.OS, "arch", opts.Arch, "arm", opts.GoARM, "CGO", opts.CGOEnabled, "386", opts.Go386, "CC", opts.CC, "CXX", opts.CXX)
		return opts
	}
}
