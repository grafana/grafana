package stats

//
// stats.go
//
// Author:   Gary Boone
//
// Copyright (c) 2011-2013 Gary Boone <gary.boone@gmail.com>.
//
// Changes:
//           20110618   initial version
//           20110705   added RandNormal() and tests/benchmarks
//           20130121	Go1 cleanup; documentation cleanup
//
// Source:
// https://github.com/GaryBoone/GoStats
//
// There are three ways to use GoStats as your program accumulates values:
// 1. Incremental or streaming -- include the new values one at a time
// 2. Incremental, in chunks -- include the new values in chunks by passing an array of values
//
//    Obtain the descriptive stats at any time by calling Mean(), Variance(), etc.
//
// 3. Batch -- just calculate results for the passed-in array. These functions are prefixed by
//    "Calc".
//
// See stats_test.go for examples of each.
//
// Descriptions of the skew and kurtosis calculations can be found here:
// http://www.tc3.edu/instruct/sbrown/stat/shape.htm
//
// For build/test help, see README.md.
//

import (
	"math"
)

// Data structure to contain accumulating values and moments
type Stats struct {
	n, min, max, sum, mean, m2, m3, m4 float64
}

//
//
// Accessor Functions
//
//

func (d *Stats) Count() int {
	return int(d.n)
}

func (d *Stats) Size() int {
	return int(d.n)
}

func (d *Stats) Min() float64 {
	return d.min
}

func (d *Stats) Max() float64 {
	return d.max
}

func (d *Stats) Sum() float64 {
	return d.sum
}

func (d *Stats) Mean() float64 {
	return d.mean
}

//
//
// Incremental Functions
//
//

// Update the stats with the given value.
func (d *Stats) Update(x float64) {
	if d.n == 0.0 || x < d.min {
		d.min = x
	}
	if d.n == 0.0 || x > d.max {
		d.max = x
	}
	d.sum += x
	nMinus1 := d.n
	d.n += 1.0
	delta := x - d.mean
	delta_n := delta / d.n
	delta_n2 := delta_n * delta_n
	term1 := delta * delta_n * nMinus1
	d.mean += delta_n
	d.m4 += term1*delta_n2*(d.n*d.n-3*d.n+3.0) + 6*delta_n2*d.m2 - 4*delta_n*d.m3
	d.m3 += term1*delta_n*(d.n-2.0) - 3*delta_n*d.m2
	d.m2 += term1
}

// Update the stats with the given array of values.
func (d *Stats) UpdateArray(data []float64) {
	for _, v := range data {
		d.Update(v)
	}
}

func (d *Stats) PopulationVariance() float64 {
	if d.n == 0 || d.n == 1 {
		return math.NaN()
	}
	return d.m2 / d.n
}

func (d *Stats) SampleVariance() float64 {
	if d.n == 0 || d.n == 1 {
		return math.NaN()
	}
	return d.m2 / (d.n - 1.0)
}

func (d *Stats) PopulationStandardDeviation() float64 {
	if d.n == 0 || d.n == 1 {
		return math.NaN()
	}
	return math.Sqrt(d.PopulationVariance())
}

func (d *Stats) SampleStandardDeviation() float64 {
	if d.n == 0 || d.n == 1 {
		return math.NaN()
	}
	return math.Sqrt(d.SampleVariance())
}

func (d *Stats) PopulationSkew() float64 {
	return math.Sqrt(d.n/(d.m2*d.m2*d.m2)) * d.m3
}

func (d *Stats) SampleSkew() float64 {
	if d.n == 2.0 {
		return math.NaN()
	}
	popSkew := d.PopulationSkew()
	return math.Sqrt(d.n*(d.n-1.0)) / (d.n - 2.0) * popSkew
}

// The kurtosis functions return _excess_ kurtosis, so that the kurtosis of a normal
// distribution = 0.0. Then kurtosis < 0.0 indicates platykurtic (flat) while
// kurtosis > 0.0 indicates leptokurtic (peaked) and near 0 indicates mesokurtic.Update
func (d *Stats) PopulationKurtosis() float64 {
	return (d.n*d.m4)/(d.m2*d.m2) - 3.0
}

func (d *Stats) SampleKurtosis() float64 {
	if d.n == 2.0 || d.n == 3.0 {
		return math.NaN()
	}
	populationKurtosis := d.PopulationKurtosis()
	return (d.n - 1.0) / ((d.n - 2.0) * (d.n - 3.0)) * ((d.n+1.0)*populationKurtosis + 6.0)
}

//
//
// Batch functions
//
// These are non-incremental functions that operate only on the data given them.
// They're prefixed with 'Calc'.
//
func StatsCount(data []float64) int {
	return len(data)
}

func StatsMin(data []float64) float64 {
	if len(data) == 0 {
		return math.NaN()
	}
	min := data[0]
	for _, v := range data {
		if v < min {
			min = v
		}
	}
	return min
}

func StatsMax(data []float64) float64 {
	if len(data) == 0 {
		return math.NaN()
	}
	max := data[0]
	for _, v := range data {
		if v > max {
			max = v
		}
	}
	return max
}

func StatsSum(data []float64) (sum float64) {
	for _, v := range data {
		sum += v
	}
	return
}

func StatsMean(data []float64) float64 {
	return StatsSum(data) / float64(len(data))
}

func sumSquaredDeltas(data []float64) (ssd float64) {
	mean := StatsMean(data)
	for _, v := range data {
		delta := v - mean
		ssd += delta * delta
	}
	return
}

func StatsPopulationVariance(data []float64) float64 {
	n := float64(len(data))
	ssd := sumSquaredDeltas(data)
	return ssd / n
}

func StatsSampleVariance(data []float64) float64 {
	n := float64(len(data))
	ssd := sumSquaredDeltas(data)
	return ssd / (n - 1.0)
}

func StatsPopulationStandardDeviation(data []float64) float64 {
	return math.Sqrt(StatsPopulationVariance(data))
}

func StatsSampleStandardDeviation(data []float64) float64 {
	return math.Sqrt(StatsSampleVariance(data))
}

func StatsPopulationSkew(data []float64) (skew float64) {
	mean := StatsMean(data)
	n := float64(len(data))

	sum3 := 0.0
	for _, v := range data {
		delta := v - mean
		sum3 += delta * delta * delta
	}

	variance := math.Sqrt(StatsPopulationVariance(data))
	skew = sum3 / n / (variance * variance * variance)
	return
}

func StatsSampleSkew(data []float64) float64 {
	popSkew := StatsPopulationSkew(data)
	n := float64(len(data))
	return math.Sqrt(n*(n-1.0)) / (n - 2.0) * popSkew
}

// The kurtosis functions return _excess_ kurtosis
func StatsPopulationKurtosis(data []float64) (kurtosis float64) {
	mean := StatsMean(data)
	n := float64(len(data))

	sum4 := 0.0
	for _, v := range data {
		delta := v - mean
		sum4 += delta * delta * delta * delta
	}

	variance := StatsPopulationVariance(data)
	kurtosis = sum4/(variance*variance)/n - 3.0
	return
}

func StatsSampleKurtosis(data []float64) float64 {
	populationKurtosis := StatsPopulationKurtosis(data)
	n := float64(len(data))
	return (n - 1.0) / ((n - 2.0) * (n - 3.0)) * ((n+1.0)*populationKurtosis + 6.0)
}
