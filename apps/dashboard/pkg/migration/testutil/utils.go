package testutil

import (
	"encoding/json"
	"fmt"
)

func PrettyPrint(label string, i interface{}) {
	b, err := json.MarshalIndent(i, "", "  ")
	if err != nil {
		fmt.Println("error:", err)
		return
	}
	fmt.Println(label, string(b))
}
