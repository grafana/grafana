package hostpool

// --- Value Calculators -----------------

import (
	"math"
)

// --- Definitions -----------------------

// Structs implementing this interface are used to convert the average response time for a host
// into a score that can be used to weight hosts in the epsilon greedy hostpool. Lower response
// times should yield higher scores (we want to select the faster hosts more often) The default
// LinearEpsilonValueCalculator just uses the reciprocal of the response time. In practice, any
// decreasing function from the positive reals to the positive reals should work.
type EpsilonValueCalculator interface {
	CalcValueFromAvgResponseTime(float64) float64
}

type LinearEpsilonValueCalculator struct{}
type LogEpsilonValueCalculator struct{ LinearEpsilonValueCalculator }
type PolynomialEpsilonValueCalculator struct {
	LinearEpsilonValueCalculator
	Exp float64 // the exponent to which we will raise the value to reweight
}

// -------- Methods -----------------------

func (c *LinearEpsilonValueCalculator) CalcValueFromAvgResponseTime(v float64) float64 {
	return 1.0 / v
}

func (c *LogEpsilonValueCalculator) CalcValueFromAvgResponseTime(v float64) float64 {
	// we need to add 1 to v so that this will be defined on all positive floats
	return c.LinearEpsilonValueCalculator.CalcValueFromAvgResponseTime(math.Log(v + 1.0))
}

func (c *PolynomialEpsilonValueCalculator) CalcValueFromAvgResponseTime(v float64) float64 {
	return c.LinearEpsilonValueCalculator.CalcValueFromAvgResponseTime(math.Pow(v, c.Exp))
}
