package stringutil

func Contains(arr []string, s string) bool {
	for _, e := range arr {
		if e == s {
			return true
		}
	}
	return false
}
