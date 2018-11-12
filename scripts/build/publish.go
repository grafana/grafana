package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var apiUrl = flag.String("apiUrl", "https://grafana.com/api", "api url")
var apiKey = flag.String("apiKey", "", "api key")
var version = ""
var versionRe = regexp.MustCompile(`grafana-(.*)(\.|_)(arm64|armhfp|aarch64|armv7|darwin|linux|windows|x86_64)`)
var debVersionRe = regexp.MustCompile(`grafana_(.*)_(arm64|armv7|armhf|amd64)\.deb`)
var builds = []build{}
var architectureMapping = map[string]string{
	"armv7":"armv7",
	"armhfp":"armv7",
	"armhf":"armv7",
	"arm64":"arm64",
	"aarch64":"arm64",
	"amd64":"amd64",
	"x86_64":"amd64",
}

func main() {
	flag.Parse()
	if *apiKey == "" {
		log.Fatalf("Require apiKey command line parameters")
	}

	err := filepath.Walk("dist", packageWalker)
	if err != nil {
		log.Fatalf("Cannot find any packages to publish, %v", err)
	}

	if version == "" {
		log.Fatalf("No version found")
	}

	if len(builds) == 0 {
		log.Fatalf("No builds found")
	}

	nightly := release{
		Version:         version,
		ReleaseDate:     time.Now(),
		Stable:          false,
		Nightly:         true,
		Beta:            false,
		WhatsNewUrl:     "",
		ReleaseNotesUrl: "",
		Builds:          builds,
	}

	postRequest("/grafana/versions", nightly, fmt.Sprintf("Create Release %s", nightly.Version))
	postRequest("/grafana/versions/"+nightly.Version, nightly, fmt.Sprintf("Update Release %s", nightly.Version))

	for _, b := range nightly.Builds {
		postRequest(fmt.Sprintf("/grafana/versions/%s/packages", nightly.Version), b, fmt.Sprintf("Create Build %s %s", b.Os, b.Arch))
		postRequest(fmt.Sprintf("/grafana/versions/%s/packages/%s/%s", nightly.Version, b.Arch, b.Os), b, fmt.Sprintf("Update Build %s %s", b.Os, b.Arch))
	}
}

func mapPackage(path string, name string, shaBytes []byte) (build, error) {
	log.Printf("Finding package file %s", name)
	result := versionRe.FindSubmatch([]byte(name))
	debResult := debVersionRe.FindSubmatch([]byte(name))

	if len(result) > 0 {
		version = string(result[1])
		log.Printf("Version detected: %v", version)
	} else if (len(debResult) > 0) {
		version = string(debResult[1])
	} else {
		return build{}, fmt.Errorf("Unable to figure out version from '%v'", name)
	}

	os := ""
	if strings.Contains(name, "linux") {
		os = "linux"
	}
	if strings.HasSuffix(name, "windows-amd64.zip") {
		os = "win"
	}
	if strings.HasSuffix(name, "darwin-amd64.tar.gz") {
		os = "darwin"
	}
	if strings.HasSuffix(name, ".rpm") {
		os = "rhel"
	}
	if strings.HasSuffix(name, ".deb") {
		os = "deb"
	}
	if os == "" {
		return build{}, fmt.Errorf("Unable to figure out os from '%v'", name)
	}

	arch := ""
	for archListed, archReal := range architectureMapping {
		if strings.Contains(name, archListed) {
			arch = archReal
			break
		}
	}
	if arch == "" {
		return build{}, fmt.Errorf("Unable to figure out arch from '%v'", name)
	}

	return build{
		Os:     os,
		Arch:   arch,
		Url:    "https://s3-us-west-2.amazonaws.com/grafana-releases/master/" + name,
		Sha256: string(shaBytes),
	}, nil
}

func packageWalker(path string, f os.FileInfo, err error) error {
	if f.Name() == "dist" || strings.Contains(f.Name(), "sha256") || strings.Contains(f.Name(), "latest") {
		return nil
	}

	shaBytes, err := ioutil.ReadFile(path + ".sha256")
	if err != nil {
		log.Fatalf("Failed to read sha256 file %v", err)
	}

	build, err := mapPackage(path, f.Name(), shaBytes)

	if err != nil {
		log.Printf("Could not map metadata from package: %v", err)
		return nil
	}

	builds = append(builds, build)
	return nil
}

func postRequest(url string, obj interface{}, desc string) {
	jsonBytes, _ := json.Marshal(obj)
	req, _ := http.NewRequest(http.MethodPost, (*apiUrl)+url, bytes.NewReader(jsonBytes))
	req.Header.Add("Authorization", "Bearer "+(*apiKey))
	req.Header.Add("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Fatalf("error: %v", err)
	}

	if res.StatusCode == http.StatusOK {
		log.Printf("Action: %s \t OK", desc)
	} else {

		if res.Body != nil {
			defer res.Body.Close()
			body, _ := ioutil.ReadAll(res.Body)
			if strings.Contains(string(body), "already exists") || strings.Contains(string(body), "Nothing to update") {
				log.Printf("Action: %s \t Already exists", desc)
			} else {
				log.Printf("Action: %s \t Failed - Status: %v", desc, res.Status)
				log.Printf("Resp: %s", body)
				log.Fatalf("Quitting")
			}
		}
	}
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
