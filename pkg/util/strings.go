package util

func StringsFallback2(val1 string, val2 string) string {
	if val1 != "" {
		return val1
	}
	return val2
}
