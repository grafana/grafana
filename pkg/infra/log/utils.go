package log

// SplitString splits a string and returns a list of strings. It supports JSON list syntax and strings separated by commas or spaces.
// It supports quoted strings with spaces, e.g. "foo bar", "baz".
// It will return an empty list if it fails to parse the string.
func SplitString(str string) []string {
	result, _ := SplitStringWithError(str)
	return result
}
