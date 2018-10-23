package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"strings"
	"time"
)

type publisher struct {
	apiKey string
}

func (p *publisher) doRelease(version string, whatsNewUrl string, releaseNotesUrl string, dryRun bool) error {
	currentRelease, err := newRelease(version, whatsNewUrl, releaseNotesUrl, buildArtifactConfigurations, getHttpContents{})
	if err != nil {
		return err
	}

	if dryRun {
		relJson, err := json.Marshal(currentRelease)
		if err != nil {
			return err
		}
		log.Println(string(relJson))

		for _, b := range currentRelease.Builds {
			artifactJson, err := json.Marshal(b)
			if err != nil {
				return err
			}
			log.Println(string(artifactJson))
		}
	} else {
		if err := p.postRelease(currentRelease); err != nil {
			return err
		}
	}

	return nil
}

func (p *publisher) postRelease(r *release) error {
	err := p.postRequest("/grafana/versions", r, fmt.Sprintf("Create Release %s", r.Version))
	if err != nil {
		return err
	}
	err = p.postRequest("/grafana/versions/"+r.Version, r, fmt.Sprintf("Update Release %s", r.Version))
	if err != nil {
		return err
	}
	for _, b := range r.Builds {
		err = p.postRequest(fmt.Sprintf("/grafana/versions/%s/packages", r.Version), b, fmt.Sprintf("Create Build %s %s", b.Os, b.Arch))
		if err != nil {
			return err
		}
		err = p.postRequest(fmt.Sprintf("/grafana/versions/%s/packages/%s/%s", r.Version, b.Arch, b.Os), b, fmt.Sprintf("Update Build %s %s", b.Os, b.Arch))
		if err != nil {
			return err
		}
	}

	return nil
}

const baseArhiveUrl = "https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana"

type buildArtifact struct {
	os         string
	arch       string
	urlPostfix string
}

func (t buildArtifact) getUrl(version string, isBeta bool) string {
	prefix := "-"
	rhelReleaseExtra := ""

	if t.os == "deb" {
		prefix = "_"
	}

	if !isBeta && t.os == "rhel" {
		rhelReleaseExtra = "-1"
	}

	url := strings.Join([]string{baseArhiveUrl, prefix, version, rhelReleaseExtra, t.urlPostfix}, "")
	return url
}

var buildArtifactConfigurations = []buildArtifact{
	{
		os:         "deb",
		arch:       "arm64",
		urlPostfix: "_arm64.deb",
	},
	{
		os:         "rhel",
		arch:       "arm64",
		urlPostfix: ".aarch64.rpm",
	},
	{
		os:         "linux",
		arch:       "arm64",
		urlPostfix: ".linux-arm64.tar.gz",
	},
	{
		os:         "deb",
		arch:       "armv7",
		urlPostfix: "_armhf.deb",
	},
	{
		os:         "rhel",
		arch:       "armv7",
		urlPostfix: ".armhfp.rpm",
	},
	{
		os:         "linux",
		arch:       "armv7",
		urlPostfix: ".linux-armv7.tar.gz",
	},
	{
		os:         "darwin",
		arch:       "amd64",
		urlPostfix: ".darwin-amd64.tar.gz",
	},
	{
		os:         "deb",
		arch:       "amd64",
		urlPostfix: "_amd64.deb",
	},
	{
		os:         "rhel",
		arch:       "amd64",
		urlPostfix: ".x86_64.rpm",
	},
	{
		os:         "linux",
		arch:       "amd64",
		urlPostfix: ".linux-amd64.tar.gz",
	},
	{
		os:         "win",
		arch:       "amd64",
		urlPostfix: ".windows-amd64.zip",
	},
}

func newRelease(rawVersion string, whatsNewUrl string, releaseNotesUrl string, artifactConfigurations []buildArtifact, getter urlGetter) (*release, error) {
	version := rawVersion[1:]
	now := time.Now()
	isBeta := strings.Contains(version, "beta")

	builds := []build{}
	for _, ba := range artifactConfigurations {
		sha256, err := getter.getContents(fmt.Sprintf("%s.sha256", ba.getUrl(version, isBeta)))
		if err != nil {
			return nil, err
		}
		builds = append(builds, newBuild(ba, version, isBeta, sha256))
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

func newBuild(ba buildArtifact, version string, isBeta bool, sha256 string) build {
	return build{
		Os:     ba.os,
		Url:    ba.getUrl(version, isBeta),
		Sha256: sha256,
		Arch:   ba.arch,
	}
}

func (p *publisher) postRequest(url string, obj interface{}, desc string) error {
	jsonBytes, err := json.Marshal(obj)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, baseUri+url, bytes.NewReader(jsonBytes))
	if err != nil {
		return err
	}
	req.Header.Add("Authorization", "Bearer "+p.apiKey)
	req.Header.Add("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}

	if res.StatusCode == http.StatusOK {
		log.Printf("Action: %s \t OK", desc)
		return nil
	}

	if res.Body != nil {
		defer res.Body.Close()
		body, err := ioutil.ReadAll(res.Body)
		if err != nil {
			return err
		}

		if strings.Contains(string(body), "already exists") || strings.Contains(string(body), "Nothing to update") {
			log.Printf("Action: %s \t Already exists", desc)
		} else {
			log.Printf("Action: %s \t Failed - Status: %v", desc, res.Status)
			log.Printf("Resp: %s", body)
			log.Fatalf("Quiting")
		}
	}

	return nil
}

type release struct {
	Version         string    `json:"version"`
	ReleaseDate     time.Time `json:"releaseDate"`
	Stable          bool      `json:"stable"`
	Beta            bool      `json:"beta"`
	Nightly         bool      `json:"nightly"`
	WhatsNewUrl     string    `json:"whatsNewUrl"`
	ReleaseNotesUrl string    `json:"releaseNotesUrl"`
	Builds          []build   `json:"-"`
}

type build struct {
	Os     string `json:"os"`
	Url    string `json:"url"`
	Sha256 string `json:"sha256"`
	Arch   string `json:"arch"`
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
