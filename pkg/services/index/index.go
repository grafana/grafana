package main

import (
	"fmt"

	"github.com/blevesearch/bleve/v2"
)

func main() {
	if err := index(); err != nil {
		fmt.Println(err)
	}
}

func index() error {
	mapping := bleve.NewIndexMapping()
	index, err := bleve.New("example.bleve", mapping)
	if err != nil {
		fmt.Println(err)
		return err
	}
	data := struct {
		Name string
	}{
		Name: "text",
	}

	// index some data
	index.Index("id", data)

	// search for some text
	query := bleve.NewMatchQuery("text")
	search := bleve.NewSearchRequest(query)
	searchResults, err := index.Search(search)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	fmt.Println(searchResults)
	return nil
}
