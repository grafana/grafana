// Command source-server serves a directory of manifests over the Source API.
// It re-reads the directory every second and publishes a new revision when content changes.
package main

import (
	"flag"
	"log"
	"net/http"
	"time"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository/source/sourceserver"
)

func main() {
	dir := flag.String("dir", "", "directory of manifests to serve")
	addr := flag.String("addr", "127.0.0.1:8099", "listen address")
	id := flag.String("id", "dev", "source id served at /v1/sources/{id}")
	token := flag.String("token", "", "bearer token required from clients (empty disables auth)")
	tier := flag.Int("tier", int(sourceserver.TierCompare), "capability tier: 0 tree, 1 revision, 2 history, 3 compare")
	flag.Parse()

	if *dir == "" {
		log.Fatal("-dir is required")
	}

	srv := sourceserver.New(sourceserver.Options{ID: *id, Tier: sourceserver.Tier(*tier), Token: *token})

	publish := func() {
		files, err := sourceserver.LoadDir(*dir)
		if err != nil {
			log.Printf("load %s: %v", *dir, err)
			return
		}
		srv.Publish(files)
	}
	publish()
	go func() {
		for range time.Tick(time.Second) {
			publish()
		}
	}()

	log.Printf("serving %s as /v1/sources/%s on http://%s (tier %d)", *dir, *id, *addr, *tier)
	log.Fatal((&http.Server{Addr: *addr, Handler: srv.Handler(), ReadHeaderTimeout: 10 * time.Second}).ListenAndServe())
}
