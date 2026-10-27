package tree

// StringToBytes converts string to byte slice without a memory allocation.
func StringToBytes(s string) []byte {
	return []byte(s)
}

// BytesToString converts byte slice to string without a memory allocation.
func BytesToString(b []byte) string {
	return string(b)
}
