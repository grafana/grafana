package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"time"
)

type releaseFromExternalContent struct {
	getter     urlGetter
	rawVersion string
}

func (re releaseFromExternalContent) prepareRelease(baseArchiveUrl, whatsNewUrl string, releaseNotesUrl string, artifactConfigurations []buildArtifact) (*release, error) {
	version := re.rawVersion[1:]
	now := time.Now()
	isBeta := strings.Contains(version, "beta")

	builds := []build{}
	for _, ba := range artifactConfigurations {
		sha256, err := re.getter.getContents(fmt.Sprintf("%s.sha256", ba.getUrl(baseArchiveUrl, version, isBeta)))
		if err != nil {
			return nil, err
		}
		builds = append(builds, newBuild(baseArchiveUrl, ba, version, isBeta, sha256))
	}

	r := release{
		Version:         version,
		ReleaseDate:     time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local),
		Stable:          !isBeta,
		Beta:            isBeta,
		Nightly:         false,
		WhatsNewUrl:     whatsNewUrl,
		ReleaseNotesUrl: releaseNotesUrl,
		Builds:          builds,
	}
	return &r, nil
}

type urlGetter interface {
	getContents(url string) (string, error)
}

type getHttpContents struct{}

func (getHttpContents) getContents(url string) (string, error) {
	response, err := http.Get(url)
	if err != nil {
		return "", err
	}

	defer response.Body.Close()
	all, err := ioutil.ReadAll(response.Body)
	if err != nil {
		return "", err
	}

	return string(all), nil
}
