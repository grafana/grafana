package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"time"
)

type releaseFromExternalContent struct {
	getter                 urlGetter
	rawVersion             string
	artifactConfigurations []buildArtifact
}

func (re releaseFromExternalContent) prepareRelease(baseArchiveURL, whatsNewURL string, releaseNotesURL string, nightly bool) (*release, error) {
	version := re.rawVersion[1:]
	beta := strings.Contains(version, "beta")
	var rt releaseType
	if beta {
		rt = BETA
	} else if nightly {
		rt = NIGHTLY
	} else {
		rt = STABLE
	}

	builds := []build{}
	for _, ba := range re.artifactConfigurations {
		sha256, err := re.getter.getContents(fmt.Sprintf("%s.sha256", ba.getURL(baseArchiveURL, version, rt)))
		if err != nil {
			return nil, err
		}
		builds = append(builds, newBuild(baseArchiveURL, ba, version, rt, sha256))
	}

	r := release{
		Version:         version,
		ReleaseDate:     time.Now().UTC(),
		Stable:          rt.stable(),
		Beta:            rt.beta(),
		Nightly:         rt.nightly(),
		WhatsNewURL:     whatsNewURL,
		ReleaseNotesURL: releaseNotesURL,
		Builds:          builds,
	}
	return &r, nil
}

type urlGetter interface {
	getContents(url string) (string, error)
}

type getHTTPContents struct{}

func (getHTTPContents) getContents(url string) (string, error) {
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
