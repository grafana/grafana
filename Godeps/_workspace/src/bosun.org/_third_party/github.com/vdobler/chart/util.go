package chart

import (
	"math"
)

func minimum(data []float64) float64 {
	if data == nil {
		return math.NaN()
	}
	min := data[0]
	for i := 1; i < len(data); i++ {
		if data[i] < min {
			min = data[i]
		}
	}
	return min
}

func maximum(data []float64) float64 {
	if data == nil {
		return math.NaN()
	}
	max := data[0]
	for i := 1; i < len(data); i++ {
		if data[i] > max {
			max = data[i]
		}
	}
	return max
}

func imin(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func imax(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func iabs(a int) int {
	if a < 0 {
		return -a
	}
	return a
}

func isign(a int) int {
	if a < 0 {
		return -1
	}
	if a == 0 {
		return 0
	}
	return 1
}

func clip(x, l, u int) int {
	if x < imin(l, u) {
		return l
	}
	if x > imax(l, u) {
		return u
	}
	return x
}

func fmax(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func fmin(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
