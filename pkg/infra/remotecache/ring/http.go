package ring

import (
	"encoding/json"
	"net/http"
	"time"
)

func buildMux(c *Cache) *http.ServeMux {
	mux := http.NewServeMux()
	mux.Handle("/remote_cache/ring/status", c.lfc)
	mux.Handle("/remote_cache/ring/kv", c.mlist)

	mux.HandleFunc("GET /remote_cache/ring/get/{key}", func(w http.ResponseWriter, r *http.Request) {
		key := r.PathValue("key")
		value, err := c.Get(r.Context(), key)
		if err != nil {
			c.logger.Error("failed to get item", "err", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Header().Add("Content-Type", "application/json")

		type response struct {
			Value []byte `json:"value"`
		}
		_ = json.NewEncoder(w).Encode(&response{Value: value})
	})

	mux.HandleFunc("POST /remote_cache/ring/add", func(w http.ResponseWriter, r *http.Request) {
		type request struct {
			Key   string `json:"key"`
			Value string `json:"value"`
		}
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			c.logger.Error("failed to parse request", "err", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		if err := c.Set(r.Context(), req.Key, []byte(req.Value), 1*time.Hour); err != nil {
			c.logger.Error("failed to set item", "err", err)
			w.WriteHeader(http.StatusBadRequest)
			return

		}
		w.WriteHeader(http.StatusOK)
	})

	mux.HandleFunc("DELETE /remote_cache/ring/delete/{key}", func(w http.ResponseWriter, r *http.Request) {
		key := r.PathValue("key")
		err := c.Delete(r.Context(), key)
		if err != nil {
			c.logger.Error("failed to delete item", "err", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		w.WriteHeader(http.StatusOK)
	})

	return mux
}
