package expr

import (
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func BenchmarkWideToMany(b *testing.B) {
	b.Run("time and *float64", func(b *testing.B) {
		f := data.NewFrame("",
			data.NewField("Time", nil, []time.Time{}))
		for i := 0; i < 10; i++ {
			lbls := make(data.Labels, 5)
			for j := 0; j < 5; j++ {
				lbls[fmt.Sprintf("lbl%d", j)] = fmt.Sprintf("value%d", i)
			}
			f.Fields = append(f.Fields, data.NewField(fmt.Sprintf("val-%d", i), lbls, []*float64{}))
		}
		for i := 0; i < 100; i++ {
			row := make([]interface{}, 0, len(f.Fields))
			row = append(row, time.Now().Add(-time.Duration(i)))
			for j := 1; j < cap(row); j++ {
				v := rand.Float64()
				row = append(row, &v)
			}
			f.AppendRow(row...)
		}

		b.ReportAllocs()
		b.ResetTimer()

		for i := 0; i < b.N; i++ {
			_, err := WideToMany(f, nil)
			if err != nil {
				panic(err)
			}
		}
	})

	b.Run("*time and int64", func(b *testing.B) { // worst case
		f := data.NewFrame("",
			data.NewField("Time", nil, []*time.Time{}))
		for i := 0; i < 10; i++ {
			lbls := make(data.Labels, 5)
			for j := 0; j < 5; j++ {
				lbls[fmt.Sprintf("lbl%d", j)] = fmt.Sprintf("value%d", i)
			}
			f.Fields = append(f.Fields, data.NewField(fmt.Sprintf("val-%d", i), lbls, []int64{}))
		}
		for i := 0; i < 100; i++ {
			row := make([]interface{}, 0, len(f.Fields))
			now := time.Now().Add(-time.Duration(i))
			row = append(row, &now)
			for j := 1; j < cap(row); j++ {
				row = append(row, rand.Int63())
			}
			f.AppendRow(row...)
		}

		b.ReportAllocs()
		b.ResetTimer()

		for i := 0; i < b.N; i++ {
			_, err := WideToMany(f, nil)
			if err != nil {
				panic(err)
			}
		}
	})
}
