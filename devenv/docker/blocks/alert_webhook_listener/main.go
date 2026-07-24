package main

import (
	"fmt"
	"html/template"
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
	tmpl, err := template.New("response").Parse("{{.}}")
	if err != nil {
		log.Printf("Failed to parse template: %v", err)
		return
	}
	if err := tmpl.Execute(w, line); err != nil {
		log.Printf("Failed to write: %v", err)
	}
}

func main() {
	http.HandleFunc("/", hello)
	log.Fatal(http.ListenAndServe(":3010", nil))
}
