package mathexp

import (
	"math/rand"

	"github.com/grafana/grafana/pkg/util"
)

func GenerateNumber(value *float64) Number {
	size := rand.Intn(5)
	labels := make(map[string]string, size)
	for i := 0; i < size; i++ {
		labels[util.GenerateShortUID()] = util.GenerateShortUID()
	}
	result := NewNumber(util.GenerateShortUID(), labels)
	result.SetValue(value)
	return result
}
