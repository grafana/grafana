package api

import (
	"context"
	"net/http"
	"strings"
)

// endWatchesOnShutdown ends watch requests when stop is cancelled, which is
// when the server begins to shut down. A watch only ends when its client or its
// own context does, and the clients of in-process apps stop only after this
// server has, so waiting for them would run out the whole grace period. A
// client whose watch ends opens a new one, as it does for any watch that ends.
func endWatchesOnShutdown(next http.Handler, stop context.Context) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !isWatchRequest(r) {
			next.ServeHTTP(w, r)
			return
		}
		ctx, cancel := context.WithCancel(r.Context())
		defer cancel()
		defer context.AfterFunc(stop, cancel)()
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func isWatchRequest(r *http.Request) bool {
	if !strings.Contains(r.URL.RawQuery, "watch") {
		return false
	}
	switch r.URL.Query().Get("watch") {
	case "true", "1":
		return true
	}
	return false
}
