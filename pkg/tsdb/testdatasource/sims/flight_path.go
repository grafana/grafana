package sims

import (
	"math"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type flightSim struct {
	cfg  flightConfig
	last flightDataPoint
}

var (
	_ Simulation = (*flightSim)(nil)
)

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

func (s *flightSim) GetConfig() SimulationConfig {
	return SimulationConfig{}
}

func (s *flightSim) SetConfig(vals map[string]interface{}) error {
	return nil
}

func (s *flightSim) GetValues(time time.Time) *data.Frame {
	return nil
}

func newFlightConfig() *flightConfig {
	return &flightConfig{
		centerLat:   37.83, // San francisco
		centerLng:   -122.42487,
		radius:      0.01, // raw gps degrees
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
		lng:      f.centerLng + math.Cos(rad)*f.radius,
		heading:  (rad * 180) / math.Pi,         // (math.Atanh(rad) * 180.0) / math.Pi, // in degrees
		altitude: f.altitudeMin + (delta * per), // clif
	}
}
