package assertions

import "fmt"

const (
	success         = ""
	needExactValues = "This assertion requires exactly %d comparison values (you provided %d)."
)

func need(needed int, expected []interface{}) string {
	if len(expected) != needed {
		return fmt.Sprintf(needExactValues, needed, len(expected))
	}
	return success
}

func atLeast(minimum int, expected []interface{}) string {
	if len(expected) < 1 {
		return shouldHaveProvidedCollectionMembers
	}
	return success
}
