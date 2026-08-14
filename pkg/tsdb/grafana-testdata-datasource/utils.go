package testdatasource

import (
	"math/rand"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type randomStringProvider struct {
	r    *rand.Rand
	data []string
}

func newRandomStringProvider(data []string) *randomStringProvider {
	return &randomStringProvider{
		r:    rand.New(rand.NewSource(time.Now().UnixNano())),
		data: data,
	}
}

func (p *randomStringProvider) Next() string {
	return p.data[p.r.Int31n(int32(len(p.data)))]
}

func dropValues(frame *data.Frame, percent float64) (*data.Frame, error) {
	if frame == nil || percent <= 0 || percent >= 100 {
		return frame, nil
	}
	rows, err := frame.RowLen()
	copy := frame.EmptyCopy()

	percentage := percent / 100.0
	seed := time.Now().UnixMilli()
	r := rand.New(rand.NewSource(seed))
	for i := 0; i < rows; i++ {
		if r.Float64() < percentage { // .2 == 20
			continue
		}

		// copy the row
		for fidx, f := range copy.Fields {
			f.Append(frame.Fields[fidx].At(i))
		}
	}

	return copy, err
}

func setFrameType(f *data.Frame, t data.FrameType, v data.FrameTypeVersion) {
	if f.Meta == nil {
		f.Meta = &data.FrameMeta{}
	}
	f.Meta.Type = t
	f.Meta.TypeVersion = v
}
