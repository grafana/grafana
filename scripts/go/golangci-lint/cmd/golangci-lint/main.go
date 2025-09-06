package main

import (
	"cmp"
	"fmt"
	"os"
	"regexp"
	"runtime/debug"
	"strings"

	"github.com/golangci/golangci-lint/v2/pkg/commands"
	"github.com/golangci/golangci-lint/v2/pkg/exitcodes"
)

var (
	goVersion = "unknown"

	// Populated by goreleaser during build
	version = "unknown"
	commit  = "?"
	date    = ""
)

func main() {
	info := createBuildInfo()

	if err := commands.Execute(info); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "The command is terminated due to an error: %v\n", err)
		os.Exit(exitcodes.Failure)
	}
}

func createBuildInfo() commands.BuildInfo {
	info := commands.BuildInfo{
		Commit:    commit,
		Version:   version,
		GoVersion: goVersion,
		Date:      date,
	}

	buildInfo, available := debug.ReadBuildInfo()
	if !available {
		return info
	}

	info.GoVersion = buildInfo.GoVersion

	if date != "" {
		return info
	}

	info.Version = buildInfo.Main.Version

	matched, _ := regexp.MatchString(`v\d+\.\d+\.\d+`, buildInfo.Main.Version)
	if matched {
		info.Version = strings.TrimPrefix(buildInfo.Main.Version, "v")
	}

	var revision string
	var modified string
	for _, setting := range buildInfo.Settings {
		// The `vcs.xxx` information is only available with `go build`.
		// This information is not available with `go install` or `go run`.
		switch setting.Key {
		case "vcs.time":
			info.Date = setting.Value
		case "vcs.revision":
			revision = setting.Value
		case "vcs.modified":
			modified = setting.Value
		}
	}

	info.Date = cmp.Or(info.Date, "(unknown)")

	info.Commit = fmt.Sprintf("(%s, modified: %s, mod sum: %q)",
		cmp.Or(revision, "unknown"), cmp.Or(modified, "?"), buildInfo.Main.Sum)

	return info
}
