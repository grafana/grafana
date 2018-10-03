package main

import (
	"flag"
	"fmt"
	"log"
	"os"
)

var baseUri string = "https://grafana.com/api"

func main() {
	var version string
	var whatsNewUrl string
	var releaseNotesUrl string
	var dryRun bool
	var apiKey string

	flag.StringVar(&version, "version", "", "Grafana version (ex: --version v5.2.0-beta1)")
	flag.StringVar(&whatsNewUrl, "wn", "", "What's new url (ex: --wn http://docs.grafana.org/guides/whats-new-in-v5-2/)")
	flag.StringVar(&releaseNotesUrl, "rn", "", "Grafana version (ex: --rn https://community.grafana.com/t/release-notes-v5-2-x/7894)")
	flag.StringVar(&apiKey, "apikey", "", "Grafana.com API key (ex: --apikey ABCDEF)")
	flag.BoolVar(&dryRun, "dry-run", false, "--dry-run")
	flag.Parse()

	if len(os.Args) == 1 {
		fmt.Println("Usage: go run publisher.go main.go --version <v> --wn <what's new url> --rn <release notes url> --apikey <api key> --dry-run false")
		fmt.Println("example: go run publisher.go main.go --version v5.2.0-beta2 --wn http://docs.grafana.org/guides/whats-new-in-v5-2/ --rn https://community.grafana.com/t/release-notes-v5-2-x/7894 --apikey ASDF123 --dry-run true")
		os.Exit(1)
	}

	if dryRun {
		log.Println("Dry-run has been enabled.")
	}

	p := publisher{apiKey: apiKey}
	if err := p.doRelease(version, whatsNewUrl, releaseNotesUrl, dryRun); err != nil {
		log.Fatalf("error: %v", err)
	}
}
