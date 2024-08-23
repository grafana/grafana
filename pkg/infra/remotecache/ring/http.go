package ring

import (
	"net/http"
)

func buildMux(c *Cache) *http.ServeMux {
	mux := http.NewServeMux()
	mux.Handle("/remote_cache/ring/status", c.lfc)
	mux.Handle("/remote_cache/ring/kv", c.mlist)
	return mux
}
