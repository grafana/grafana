package main

import (
	"fmt"
	"github.com/pkg/errors"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

type releaseLocalSources struct {
	path string
	artifactConfigurations []buildArtifact
}

func (r releaseLocalSources) prepareRelease(baseArchiveUrl, whatsNewUrl string, releaseNotesUrl string) (*release, error) {
	buildData := r.findBuilds(baseArchiveUrl)

	now := time.Now()
	rel := release{
		Version:         buildData.version,
		ReleaseDate:     time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local),
		Stable:          false,
		Beta:            false,
		Nightly:         true,
		WhatsNewUrl:     whatsNewUrl,
		ReleaseNotesUrl: releaseNotesUrl,
		Builds:          buildData.builds,
	}

	return &rel, nil
}

type buildData struct {
	version string
	builds []build
}

func (r releaseLocalSources) findBuilds(baseArchiveUrl string) buildData {
	data := buildData{}
	filepath.Walk(r.path, createBuildWalker(r.path, &data, r.artifactConfigurations, baseArchiveUrl))
	return data
}

func createBuildWalker(path string, data *buildData, archiveTypes []buildArtifact, baseArchiveUrl string) func(path string, f os.FileInfo, err error) error {
	return func(path string, f os.FileInfo, err error) error {
		if err != nil {
			log.Printf("error: %v", err)
		}

		if f.Name() == path || strings.HasSuffix(f.Name(), ".sha256") {
			return nil
		}

		for _, archive := range archiveTypes {
			if strings.HasSuffix(f.Name(), archive.urlPostfix) {
				shaBytes, err := ioutil.ReadFile(path + ".sha256")
				if err != nil {
					log.Fatalf("Failed to read sha256 file %v", err)
				}

				version, err := grabVersion(f.Name(), archive.urlPostfix)
				if err != nil {
					log.Println(err)
					continue
				}
				data.version = version
				data.builds = append(data.builds, build{
					Os:     archive.os,
					Url:    archive.getUrl(baseArchiveUrl, version, false),
					Sha256: string(shaBytes),
					Arch:   archive.arch,
				})
				return nil
			}
		}
		return nil
	}

}
func grabVersion(name string, suffix string) (string, error) {
	match := regexp.MustCompile(fmt.Sprintf(`grafana(-enterprise)?[-_](.*)%s`, suffix)).FindSubmatch([]byte(name))
	if len(match) > 0 {
		return string(match[2]), nil
	}

	return "", errors.New("No version found.")
}
