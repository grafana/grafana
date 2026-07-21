package fakes

import (
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
)

// randInt returns a cryptographically random non-negative int.
func randInt() int {
	var b [8]byte
	_, err := rand.Read(b[:])
	if err != nil {
		panic(err)
	}
	return int(binary.BigEndian.Uint64(b[:]) & 0x7fffffffffffffff)
}

// randIntn returns a cryptographically random non-negative int in [0, n).
func randIntn(n int) int {
	if n <= 0 {
		panic("randIntn: n must be positive")
	}
	return randInt() % n
}

// randInt63n returns a cryptographically random non-negative int64 in [0, n).
func randInt63n(n int64) int64 {
	if n <= 0 {
		panic("randInt63n: n must be positive")
	}
	var b [8]byte
	_, err := rand.Read(b[:])
	if err != nil {
		panic(err)
	}
	return int64(binary.BigEndian.Uint64(b[:])&0x7fffffffffffffff) % n
}

var UTCLocation = "UTC"

// +k8s:openapi-gen=false
type IntervalMutator func(spec *v1beta1.TimeIntervalInterval)

// +k8s:openapi-gen=false
type IntervalGenerator struct {
	mutators []IntervalMutator
}

func (t IntervalGenerator) With(mutators ...IntervalMutator) IntervalGenerator {
	return IntervalGenerator{
		mutators: append(t.mutators, mutators...),
	}
}

func (t IntervalGenerator) generateDaysOfMonth() string {
	isRange := randInt()%2 == 0
	if !isRange {
		return fmt.Sprintf("%d", randIntn(30)+1)
	}
	from := randIntn(15) + 1
	to := randIntn(31-from) + from + 1
	return fmt.Sprintf("%d:%d", from, to)
}

func (t IntervalGenerator) generateTimeRange() v1beta1.TimeIntervalTimeRange {
	from := randInt63n(1440 / 2)        // [0, 719]
	to := from + randInt63n(1440/2) + 1 // from < ([0,719] + [1,720]) < 1440
	return v1beta1.TimeIntervalTimeRange{
		StartTime: time.Unix(from*60, 0).UTC().Format("15:04"),
		EndTime:   time.Unix(to*60, 0).UTC().Format("15:04"),
	}
}

func (t IntervalGenerator) generateWeekday() string {
	day := randIntn(7)
	return strings.ToLower(time.Weekday(day).String())
}

func (t IntervalGenerator) generateYear() string {
	from := 1970 + randIntn(100)
	if randInt()%3 == 0 {
		to := 1970 + from + randIntn(10) + 1
		return fmt.Sprintf("%d:%d", from, to)
	}
	return fmt.Sprintf("%d", from)
}

func (t IntervalGenerator) generateLocation() *string {
	if randInt()%3 == 0 {
		return nil
	}
	return &UTCLocation
}

func (t IntervalGenerator) generateMonth() string {
	return fmt.Sprintf("%d", randIntn(12)+1)
}

func (t IntervalGenerator) GenerateMany(count int) []v1beta1.TimeIntervalInterval {
	result := make([]v1beta1.TimeIntervalInterval, 0, count)
	for i := 0; i < count; i++ {
		result = append(result, t.Generate())
	}
	return result
}

func (t IntervalGenerator) Generate() v1beta1.TimeIntervalInterval {
	i := v1beta1.TimeIntervalInterval{
		DaysOfMonth: generateMany(randIntn(6), true, t.generateDaysOfMonth),
		Location:    t.generateLocation(),
		Months:      generateMany(randIntn(3), true, t.generateMonth),
		Times:       generateMany(randIntn(6), true, t.generateTimeRange),
		Weekdays:    generateMany(randIntn(3), true, t.generateWeekday),
		Years:       generateMany(randIntn(3), true, t.generateYear),
	}
	for _, mutator := range t.mutators {
		mutator(&i)
	}
	return i
}

func generateMany[T comparable](repeatTimes int, unique bool, f func() T) []T {
	qty := repeatTimes + 1
	result := make([]T, 0, qty)
	for i := 0; i < qty; i++ {
		r := f()
		if unique && slices.Contains(result, r) {
			continue
		}
		result = append(result, f())
	}
	return result
}
