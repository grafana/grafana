package web

import "net/http"

const HeaderContentType = "Content-Type"

type ContentType string

const charsetUTF8 = "; charset=UTF-8"

const (
	TextHTML ContentType = "text/html" + charsetUTF8
	AppJSON  ContentType = "application/json" + charsetUTF8
)

func SetContentType(w http.ResponseWriter, c ContentType) {
	w.Header().Set("Content-Type", string(c))
}
