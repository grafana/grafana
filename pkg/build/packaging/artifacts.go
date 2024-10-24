package packaging

import (
	"github.com/grafana/grafana/pkg/build/config"
)

const ReleaseFolder = "release"
const MainFolder = "main"
const EnterpriseSfx = "-enterprise"
const CacheSettings = "Cache-Control:public, max-age="

type BuildArtifact struct {
	// Distro can be "windows", "darwin", "deb", "rhel", or "linux"
	Distro string
	Arch   string
	// Ext is the file extension without the "."
	Ext         string
	Musl        bool
	RaspberryPi bool

	// URL can be set optionally by another process
	// Note: check other repos before determining this to be dead code
	URL string
}

type PublishConfig struct {
	config.Config

	Edition         config.Edition
	ReleaseMode     config.ReleaseMode
	GrafanaAPIKey   string
	WhatsNewURL     string
	ReleaseNotesURL string
	DryRun          bool
	TTL             string
	SimulateRelease bool
}

var LinuxArtifacts = []BuildArtifact{
	{
		Distro: "linux",
		Arch:   "arm64",
		Ext:    "tar.gz",
	},
	{
		Distro: "deb",
		Arch:   "amd64",
		Ext:    "deb",
	},
	{
		Distro: "rhel",
		Arch:   "x86_64",
		Ext:    "rpm",
	},
	{
		Distro: "linux",
		Arch:   "amd64",
		Ext:    "tar.gz",
	},
}

var DarwinArtifacts = []BuildArtifact{
	{
		Distro: "darwin",
		Arch:   "amd64",
		Ext:    "tar.gz",
	},
}

var WindowsArtifacts = []BuildArtifact{
	{
		Distro: "windows",
		Arch:   "amd64",
		Ext:    "zip",
	},
	{
		Distro: "windows",
		Arch:   "amd64",
		Ext:    "msi",
	},
}

var ARMArtifacts = []BuildArtifact{
	{
		Distro: "deb",
		Arch:   "arm64",
		Ext:    "deb",
	},
	{
		Distro: "rhel",
		Arch:   "aarch64",
		Ext:    "rpm",
	},
	{
		Distro:      "deb",
		Arch:        "armhf",
		Ext:         "deb",
		RaspberryPi: false,
	},
	{
		Distro:      "deb",
		Arch:        "armhf",
		RaspberryPi: true,
		Ext:         "deb",
	},
	{
		Distro: "linux",
		Arch:   "armv6",
		Ext:    "tar.gz",
	},
	{
		Distro: "linux",
		Arch:   "armv7",
		Ext:    "tar.gz",
	},
	{
		Distro: "linux",
		Arch:   "arm64",
		Ext:    "tar.gz",
	},
	{
		Distro: "linux",
		Arch:   "amd64",
		Ext:    "tar.gz",
	},
}

func join(a []BuildArtifact, b ...[]BuildArtifact) []BuildArtifact {
	for i := range b {
		a = append(a, b[i]...)
	}

	return a
}

var ArtifactConfigs = join(LinuxArtifacts, DarwinArtifacts, WindowsArtifacts, ARMArtifacts)
