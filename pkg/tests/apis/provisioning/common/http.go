package common

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
)

func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func ServeRecorded(r *http.Request, handler http.HandlerFunc) *http.Response {
	rec := httptest.NewRecorder()
	handler(rec, r)
	resp := rec.Result()
	resp.Request = r
	return resp
}
