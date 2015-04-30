package chart

import (
	"math"
	"sort"
)

// Return p percentil of pre-sorted integer data. 0 <= p <= 100.
func PercentilInt(data []int, p int) int {
	n := len(data)
	if n == 0 {
		return 0
	}
	if n == 1 {
		return data[0]
	}

	pos := float64(p) * float64(n+1) / 100
	fpos := math.Floor(pos)
	intPos := int(fpos)
	dif := pos - fpos
	if intPos < 1 {
		return data[0]
	}
	if intPos >= n {
		return data[n-1]
	}
	lower := data[intPos-1]
	upper := data[intPos]
	val := float64(lower) + dif*float64(upper-lower)
	return int(math.Floor(val + 0.5))
}

// Return p percentil of pre-sorted float64 data. 0 <= p <= 100.
func percentilFloat64(data []float64, p int) float64 {
	n := len(data)
	if n == 0 {
		return 0
	}
	if n == 1 {
		return data[0]
	}

	pos := float64(p) * float64(n+1) / 100
	fpos := math.Floor(pos)
	intPos := int(fpos)
	dif := pos - fpos
	if intPos < 1 {
		return data[0]
	}
	if intPos >= n {
		return data[n-1]
	}
	lower := data[intPos-1]
	upper := data[intPos]
	val := lower + dif*(upper-lower)
	return val
}

// Compute minimum, p percentil, median, average, 100-p percentil and maximum of values in data.
func SixvalInt(data []int, p int) (min, lq, med, avg, uq, max int) {
	min, max = math.MaxInt32, math.MinInt32
	sum, n := 0, len(data)
	if n == 0 {
		return
	}
	if n == 1 {
		min = data[0]
		lq = data[0]
		med = data[0]
		avg = data[0]
		uq = data[0]
		max = data[0]
		return
	}
	for _, v := range data {
		if v < min {
			min = v
		}
		if v > max {
			max = v
		}
		sum += v
	}

	avg = sum / n

	sort.Ints(data)

	if n%2 == 1 {
		med = data[(n-1)/2]
	} else {
		med = (data[n/2] + data[n/2-1]) / 2
	}

	lq = PercentilInt(data, p)
	uq = PercentilInt(data, 100-p)
	return
}

// Compute minimum, p percentil, median, average, 100-p percentil and maximum of values in data.
func SixvalFloat64(data []float64, p int) (min, lq, med, avg, uq, max float64) {
	n := len(data)

	// Special cases 0 and 1
	if n == 0 {
		return
	}

	if n == 1 {
		min = data[0]
		lq = data[0]
		med = data[0]
		avg = data[0]
		uq = data[0]
		max = data[0]
		return
	}

	// First pass (min, max, coarse average)
	var sum float64
	min, max = math.MaxFloat64, -math.MaxFloat64
	for _, v := range data {
		if v < min {
			min = v
		}
		if v > max {
			max = v
		}
		sum += v
	}
	avg = sum / float64(n)

	// Second pass: Correct average
	var corr float64
	for _, v := range data {
		corr += v - avg
	}
	avg += corr / float64(n)

	// Median
	sort.Float64s(data)
	if n%2 == 1 {
		med = data[(n-1)/2]
	} else {
		med = (data[n/2] + data[n/2-1]) / 2
	}

	// Percentiles
	if p < 0 {
		p = 0
	}
	if p > 100 {
		p = 100
	}
	lq = percentilFloat64(data, p)
	uq = percentilFloat64(data, 100-p)
	return
}
