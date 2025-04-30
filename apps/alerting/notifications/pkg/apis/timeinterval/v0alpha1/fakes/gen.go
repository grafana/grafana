package fakes

import (
	"fmt"
	"math/rand"
	"slices"
	"strings"
	"time"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/timeinterval/v0alpha1"
	"github.com/grafana/grafana/pkg/util"
)

// +k8s:openapi-gen=false
type IntervalMutator func(spec *v0alpha1.Interval)

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
	isRange := rand.Int()%2 == 0
	if !isRange {
		return fmt.Sprintf("%d", rand.Intn(30)+1)
	}
	from := rand.Intn(15) + 1
	to := rand.Intn(31-from) + from + 1
	return fmt.Sprintf("%d:%d", from, to)
}

func (t IntervalGenerator) generateTimeRange() v0alpha1.TimeRange {
	from := rand.Int63n(1440 / 2)        // [0, 719]
	to := from + rand.Int63n(1440/2) + 1 // from < ([0,719] + [1,720]) < 1440
	return v0alpha1.TimeRange{
		StartTime: time.Unix(from*60, 0).UTC().Format("15:04"),
		EndTime:   time.Unix(to*60, 0).UTC().Format("15:04"),
	}
}

func (t IntervalGenerator) generateWeekday() string {
	day := rand.Intn(7)
	return strings.ToLower(time.Weekday(day).String())
}

func (t IntervalGenerator) generateYear() string {
	from := 1970 + rand.Intn(100)
	if rand.Int()%3 == 0 {
		to := 1970 + from + rand.Intn(10) + 1
		return fmt.Sprintf("%d:%d", from, to)
	}
	return fmt.Sprintf("%d", from)
}

func (t IntervalGenerator) generateLocation() *string {
	if rand.Int()%3 == 0 {
		return nil
	}
	return util.Pointer("UTC")
}

func (t IntervalGenerator) generateMonth() string {
	return fmt.Sprintf("%d", rand.Intn(12)+1)
}

func (t IntervalGenerator) GenerateMany(count int) []v0alpha1.Interval {
	result := make([]v0alpha1.Interval, 0, count)
	for i := 0; i < count; i++ {
		result = append(result, t.Generate())
	}
	return result
}

func (t IntervalGenerator) Generate() v0alpha1.Interval {
	i := v0alpha1.Interval{
		DaysOfMonth: generateMany(rand.Intn(6), true, t.generateDaysOfMonth),
		Location:    t.generateLocation(),
		Months:      generateMany(rand.Intn(3), true, t.generateMonth),
		Times:       generateMany(rand.Intn(6), true, t.generateTimeRange),
		Weekdays:    generateMany(rand.Intn(3), true, t.generateWeekday),
		Years:       generateMany(rand.Intn(3), true, t.generateYear),
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
