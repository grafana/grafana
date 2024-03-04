package sql

import "fmt"

func Translate(text string, schema string) (string, error) {
	// TODO - kuba call our python api running in a container
	fmt.Println(text)
	fmt.Println(schema)
	return "", nil
}
