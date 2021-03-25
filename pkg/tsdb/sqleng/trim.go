package sqleng

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// trim trims rows that are outside the qm.TimeRange
func trim(f *data.Frame, qm DataQueryModel) error {
	tsSchema := f.TimeSeriesSchema()
	if tsSchema.Type == data.TimeSeriesTypeNot {
		return fmt.Errorf("can not trim, not timeseries frame")
	}
	timeField := f.Fields[tsSchema.TimeIndex]

	if timeField.Len() == 0 {
		return nil
	}

	for i := timeField.Len() - 1; i >= 0; i-- {
		t, ok := timeField.ConcreteAt(i)
		if !ok {
			return fmt.Errorf("Time point is nil")
		}

		if t.(time.Time).After(qm.TimeRange.To) {
			f.DeleteRow(i)
			continue
		}

		// if t.Equal(qm.TimeRange.To) || t.Before(qm.TimeRange.To)
		break
	}

	for i := 0; i < timeField.Len(); i++ {
		t, ok := timeField.ConcreteAt(i)
		if !ok {
			return fmt.Errorf("Time point is nil")
		}

		if t.(time.Time).Before(qm.TimeRange.From) {
			f.DeleteRow(i)
			i--
			continue
		}

		// if t.Equal(qm.TimeRange.From) || t.After(qm.TimeRange.From)
		break
	}
	return nil
}
