package fakes

import "net/http"

func NewFakeHTTPHandler(status int, res []byte) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		w.WriteHeader(status)
		_, err := w.Write(res)
		if err != nil {
			panic(err)
		}
	}
}
