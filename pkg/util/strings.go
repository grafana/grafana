package util

func StringsFallback2(val1 string, val2 string) string {
	if val1 != "" {
		return val1
	}
	return val2
}

func StringsFallback3(val1 string, val2 string, val3 string) string {
	if val1 != "" {
		return val1
	}
	if val2 != "" {
		return val2
	}
	return val3
}
