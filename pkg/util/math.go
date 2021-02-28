package util

// MinInt returns the smaller of x or y.
func MinInt(x, y int) int {
	if x > y {
		return y
	}
	return x
}
