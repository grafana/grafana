package main

import (
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
)

func hello(w http.ResponseWriter, r *http.Request) {
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return
	}

	line := fmt.Sprintf("webbhook: -> %s", string(body))
	fmt.Println(line)
	if _, err := io.WriteString(w, line); err != nil {
		log.Printf("Failed to write: %v", err)
	}
}

func main() {
	http.HandleFunc("/", hello)
	log.Fatal(http.ListenAndServe(":3010", nil))
}
