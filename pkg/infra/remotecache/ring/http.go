package ring

import (
	"encoding/json"
	"net/http"
	"time"
)

func buildMux(c *Cache) *http.ServeMux {
	mux := http.NewServeMux()
	mux.Handle("/remote_cache/ring", c.lfc)
	mux.Handle("/remote_cache/kv", c.mlist)

	mux.HandleFunc("GET /cache/{key}", func(w http.ResponseWriter, r *http.Request) {
		key := r.PathValue("key")
		c.logger.Info("get cached item", "key", key)
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

	mux.HandleFunc("DELETE /cache/{key}", func(w http.ResponseWriter, r *http.Request) {
		key := r.PathValue("key")
		c.logger.Info("delete cached item", "key", key)
		err := c.Delete(r.Context(), key)
		if err != nil {
			c.logger.Error("failed to delete item", "err", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		w.WriteHeader(http.StatusOK)
	})

	mux.HandleFunc("POST /cache", func(w http.ResponseWriter, r *http.Request) {
		c.logger.Info("set new item")
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

	return mux
}
