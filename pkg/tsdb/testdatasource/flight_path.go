package testdatasource

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
)

func (p *testDataPlugin) handleFlightPathScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		_, err := simplejson.NewJson(q.JSON)
		if err != nil {
			return nil, fmt.Errorf("failed to parse query json: %v", err)
		}

		timeWalkerMs := q.TimeRange.From.UnixNano() / int64(time.Millisecond)
		to := q.TimeRange.To.UnixNano() / int64(time.Millisecond)
		stepMillis := q.Interval.Milliseconds()

		cfg := newFlightConfig()

		maxPoints := q.MaxDataPoints * 2
		f := cfg.initFields()
		for i := int64(0); i < maxPoints && timeWalkerMs < to; i++ {
			t := time.Unix(timeWalkerMs/int64(1e+3), (timeWalkerMs%int64(1e+3))*int64(1e+6))
			f.append(cfg.getNextPoint(t))

			timeWalkerMs += stepMillis
		}

		// When close to now, link to the live streaming channel
		if q.TimeRange.To.Add(time.Second * 2).After(time.Now()) {
			f.frame.Meta = &data.FrameMeta{
				Channel: "plugin/testdata/flight-5hz-stream",
			}
		}

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, f.frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

type flightDataPoint struct {
	time     time.Time
	lat      float64 // gps
	lng      float64 // gps
	heading  float64 // degree
	altitude float64 // above ground
}

type flightConfig struct {
	centerLat   float64
	centerLng   float64
	radius      float64
	altitudeMin float64
	altitudeMax float64
	periodS     float64 // angular speed
}

func newFlightConfig() *flightConfig {
	return &flightConfig{
		centerLat:   37.773972, // San francisco
		centerLng:   -122.431297,
		radius:      0.1, // raw gps degrees
		altitudeMin: 350,
		altitudeMax: 400,
		periodS:     10, //model.Get("period").MustFloat64(10),
	}
}

type flightFields struct {
	time     *data.Field
	lat      *data.Field
	lng      *data.Field
	heading  *data.Field
	altitude *data.Field

	frame *data.Frame
}

func (f *flightConfig) initFields() *flightFields {
	ff := &flightFields{
		time:     data.NewFieldFromFieldType(data.FieldTypeTime, 0),
		lat:      data.NewFieldFromFieldType(data.FieldTypeFloat64, 0),
		lng:      data.NewFieldFromFieldType(data.FieldTypeFloat64, 0),
		heading:  data.NewFieldFromFieldType(data.FieldTypeFloat64, 0),
		altitude: data.NewFieldFromFieldType(data.FieldTypeFloat64, 0),
	}
	ff.time.Name = "time"
	ff.lat.Name = "lat"
	ff.lng.Name = "lng"
	ff.heading.Name = "heading"
	ff.altitude.Name = "altitude"

	ff.frame = data.NewFrame("", ff.time, ff.lat, ff.lng, ff.heading, ff.altitude)
	return ff
}

func (f *flightFields) append(v flightDataPoint) {
	f.frame.AppendRow(v.time, v.lat, v.lng, v.heading, v.altitude)
}

func (f *flightFields) set(idx int, v flightDataPoint) {
	f.time.Set(idx, v.time)
	f.lat.Set(idx, v.lat)
	f.lng.Set(idx, v.lng)
	f.heading.Set(idx, v.heading)
	f.altitude.Set(idx, v.altitude)
}

func (f *flightConfig) getNextPoint(t time.Time) flightDataPoint {
	periodNS := int64(f.periodS * float64(time.Second))
	ms := t.UnixNano() % periodNS
	per := float64(ms) / float64(periodNS)
	rad := per * 2.0 * math.Pi // 0 >> 2Pi
	delta := f.altitudeMax - f.altitudeMin

	return flightDataPoint{
		time:     t,
		lat:      f.centerLat + math.Sin(rad)*f.radius,
		lng:      f.centerLng + math.Sin(rad+math.Pi)*f.radius,
		heading:  (rad * 180) / math.Pi,         // (math.Atanh(rad) * 180.0) / math.Pi, // in degrees
		altitude: f.altitudeMin + (delta * per), // clif
	}
}
