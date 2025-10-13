//go:build !(enterprise || pro)

package frontend

import "fmt"

func processIndexViewData(indexViewData *IndexViewData) {
	fmt.Println("josh oss hook fn")
	// no-op
}
