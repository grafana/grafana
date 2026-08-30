package embedder

import "math"

// NormalizeDenseInPlace L2-normalizes a dense vector. No-op for empty or
// zero vectors (a zero-norm vector has no meaningful direction; leaving it
// alone is safer than dividing by zero).
func NormalizeDenseInPlace(vec []float32) {
	var sumSquares float64
	for _, v := range vec {
		f := float64(v)
		sumSquares += f * f
	}
	if sumSquares == 0 {
		return
	}
	inv := float32(1 / math.Sqrt(sumSquares))
	for i := range vec {
		vec[i] *= inv
	}
}

// NormalizeDenseBatch L2-normalizes each vector in the slice.
func NormalizeDenseBatch(vectors [][]float32) {
	for i := range vectors {
		NormalizeDenseInPlace(vectors[i])
	}
}
