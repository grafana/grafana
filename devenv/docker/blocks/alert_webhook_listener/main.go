package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
)

func hello(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return
	}

	safeBody := strings.ReplaceAll(string(body), "\n", "")
	line := fmt.Sprintf("webbhook: -> %s", safeBody)
	fmt.Println(line)
	if _, err := io.WriteString(w, line); err != nil {
		log.Printf("Failed to write: %v", err)
	}
}

func main() {
	http.HandleFunc("/", hello)
	log.Fatal(http.ListenAndServe(":3010", nil))
}
