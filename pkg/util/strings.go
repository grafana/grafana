package util

func StringsFallback2(val1 string, val2 string) string {
	return stringsFallback(val1, val2)
}

func StringsFallback3(val1 string, val2 string, val3 string) string {
	return stringsFallback(val1, val2, val3)
}

func stringsFallback(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
