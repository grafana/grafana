package packaging

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/build/config"
)

const ReleaseFolder = "release"
const MainFolder = "main"
const EnterpriseSfx = "-enterprise"
const CacheSettings = "Cache-Control:public, max-age="

type buildArtifact struct {
	Os             string
	Arch           string
	urlPostfix     string
	packagePostfix string
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

const rhelOS = "rhel"
const debOS = "deb"

func (t buildArtifact) GetURL(baseArchiveURL string, cfg PublishConfig) string {
	rev := ""
	prefix := "-"
	if t.Os == debOS {
		prefix = "_"
	} else if t.Os == rhelOS {
		rev = "-1"
	}

	version := cfg.Version
	verComponents := strings.Split(version, "-")
	if len(verComponents) > 2 {
		panic(fmt.Sprintf("Version string contains more than one hyphen: %q", version))
	}

	switch t.Os {
	case debOS, rhelOS:
		if len(verComponents) > 1 {
			// With Debian and RPM packages, it's customary to prefix any pre-release component with a ~, since this
			// is considered of lower lexical value than the empty character, and this way pre-release versions are
			// considered to be of a lower version than the final version (which lacks this suffix).
			version = fmt.Sprintf("%s~%s", verComponents[0], verComponents[1])
		}
	}

	// https://dl.grafana.com/oss/main/grafana_8.5.0~54094pre_armhf.deb: 404 Not Found
	url := fmt.Sprintf("%s%s%s%s%s%s", baseArchiveURL, t.packagePostfix, prefix, version, rev, t.urlPostfix)
	return url
}

var ArtifactConfigs = []buildArtifact{
	{
		Os:         debOS,
		Arch:       "arm64",
		urlPostfix: "_arm64.deb",
	},
	{
		Os:         rhelOS,
		Arch:       "arm64",
		urlPostfix: ".aarch64.rpm",
	},
	{
		Os:         "linux",
		Arch:       "arm64",
		urlPostfix: ".linux-arm64.tar.gz",
	},
	{
		Os:         debOS,
		Arch:       "armv7",
		urlPostfix: "_armhf.deb",
	},
	{
		Os:             debOS,
		Arch:           "armv6",
		packagePostfix: "-rpi",
		urlPostfix:     "_armhf.deb",
	},
	{
		Os:         rhelOS,
		Arch:       "armv7",
		urlPostfix: ".armhfp.rpm",
	},
	{
		Os:         "linux",
		Arch:       "armv6",
		urlPostfix: ".linux-armv6.tar.gz",
	},
	{
		Os:         "linux",
		Arch:       "armv7",
		urlPostfix: ".linux-armv7.tar.gz",
	},
	{
		Os:         "darwin",
		Arch:       "amd64",
		urlPostfix: ".darwin-amd64.tar.gz",
	},
	{
		Os:         "deb",
		Arch:       "amd64",
		urlPostfix: "_amd64.deb",
	},
	{
		Os:         rhelOS,
		Arch:       "amd64",
		urlPostfix: ".x86_64.rpm",
	},
	{
		Os:         "linux",
		Arch:       "amd64",
		urlPostfix: ".linux-amd64.tar.gz",
	},
	{
		Os:         "win",
		Arch:       "amd64",
		urlPostfix: ".windows-amd64.zip",
	},
	{
		Os:         "win-installer",
		Arch:       "amd64",
		urlPostfix: ".windows-amd64.msi",
	},
}
