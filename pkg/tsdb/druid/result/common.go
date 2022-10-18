package result

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type Framer interface {
	Frame() *data.Frame
}

const timestampColumn = "timestamp"

func toTypedResults(raw []interface{}) interface{} {
	// TODO this is not perfect. Maybe we should get this from the query?
	switch raw[0].(type) {
	// TODO this can be done with generics, but we should wait until go is updated in this repo
	case string:
		results := make([]string, len(raw))
		for i, v := range raw {
			vv, _ := v.(string)
			results[i] = vv
		}
		return results
	case int:
		results := make([]int, len(raw))
		for i, v := range raw {
			vv, _ := v.(int)
			results[i] = vv
		}
		return results
	case int32:
		results := make([]int32, len(raw))
		for i, v := range raw {
			vv, _ := v.(int32)
			results[i] = vv
		}
		return results
	case int64:
		results := make([]int64, len(raw))
		for i, v := range raw {
			vv, _ := v.(int64)
			results[i] = vv
		}
		return results
	case float32:
		results := make([]float32, len(raw))
		for i, v := range raw {
			vv, _ := v.(float32)
			results[i] = vv
		}
		return results
	case float64:
		results := make([]float64, len(raw))
		for i, v := range raw {
			vv, _ := v.(float64)
			results[i] = vv
		}
		return results
	case bool:
		results := make([]bool, len(raw))
		for i, v := range raw {
			vv, _ := v.(bool)
			results[i] = vv
		}
		return results
	case time.Time:
		results := make([]time.Time, len(raw))
		for i, v := range raw {
			vv, _ := v.(time.Time)
			results[i] = vv
		}
		return results
	default:
		// TODO better error handling
		log.DefaultLogger.Debug("Unsupported value %T", raw[0])
		return nil
	}
}
