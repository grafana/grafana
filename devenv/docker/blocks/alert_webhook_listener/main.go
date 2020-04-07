package main

import (
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
)

func hello(w http.ResponseWriter, r *http.Request) {
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return
	}

	line := fmt.Sprintf("webbhook: -> %s", string(body))
	fmt.Println(line)
	io.WriteString(w, line)
}

func main() {
	http.HandleFunc("/", hello)
	http.ListenAndServe(":3010", nil)
}
