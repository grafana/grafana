package sims

import (
	"math"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type flightSim struct {
	key simulationKey
	cfg flightConfig
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
	CenterLat   float64 `json:"centerLat"`
	CenterLng   float64 `json:"centerLng"`
	Radius      float64 `json:"radius"`
	AltitudeMin float64 `json:"altitudeMin"`
	AltitudeMax float64 `json:"altitudeMax"`
	Period      float64 `json:"period"` // angular speed (seconds)
}

func (s *flightSim) GetState() simulationState {
	return simulationState{
		Key:    s.key,
		Config: s.cfg,
	}
}

func (s *flightSim) SetConfig(vals map[string]interface{}) error {
	return updateConfigObjectFromJSON(s.cfg, vals)
}

func (s *flightSim) NewFrame(size int) *data.Frame {
	frame := data.NewFrameOfFieldTypes("", size,
		data.FieldTypeTime,    // time
		data.FieldTypeFloat64, // lat
		data.FieldTypeFloat64, // lng
		data.FieldTypeFloat64, // heading
		data.FieldTypeFloat64, // altitude
	)
	frame.Fields[0].Name = "time"
	frame.Fields[1].Name = "lat"
	frame.Fields[2].Name = "lng"
	frame.Fields[3].Name = "heading"
	frame.Fields[4].Name = "altitude"
	return frame
}

func (s *flightSim) GetValues(t time.Time) map[string]interface{} {
	p := s.cfg.getNextPoint(t)

	return map[string]interface{}{
		"time":     p.time,
		"lat":      p.lat,
		"lng":      p.lng,
		"heading":  p.heading,
		"altitude": p.altitude,
	}
}

func (s *flightSim) Close() error {
	return nil
}

func newFlightSimInfo() simulationInfo {
	sf := flightConfig{
		CenterLat:   37.83, // San francisco
		CenterLng:   -122.42487,
		Radius:      0.01, // raw gps degrees
		AltitudeMin: 350,
		AltitudeMax: 400,
		Period:      10, //model.Get("period").MustFloat64(10),
	}

	df := data.NewFrame("")
	df.Fields = append(df.Fields, data.NewField("centerLat", nil, []float64{sf.CenterLat}))
	df.Fields = append(df.Fields, data.NewField("centerLng", nil, []float64{sf.CenterLng}))
	df.Fields = append(df.Fields, data.NewField("radius", nil, []float64{sf.Radius}))
	df.Fields = append(df.Fields, data.NewField("altitudeMin", nil, []float64{sf.AltitudeMin}))
	df.Fields = append(df.Fields, data.NewField("altitudeMax", nil, []float64{sf.AltitudeMax}))

	f := data.NewField("period", nil, []float64{sf.Period})
	f.Config = &data.FieldConfig{Unit: "s"} // seconds
	df.Fields = append(df.Fields, f)

	return simulationInfo{
		Type:         "flight",
		Name:         "Flight",
		Description:  "simple circling airplain",
		ConfigFields: df,
		OnlyForward:  false,
		create: func(cfg simulationState) (Simulation, error) {
			s := &flightSim{
				key: cfg.Key,
				cfg: sf, // default value
			}
			err := updateConfigObjectFromJSON(&s.cfg, cfg.Config) // override any fields
			return s, err
		},
	}
}

func (f *flightConfig) getNextPoint(t time.Time) flightDataPoint {
	periodNS := int64(f.Period * float64(time.Second))
	ms := t.UnixNano() % periodNS
	per := float64(ms) / float64(periodNS)
	rad := per * 2.0 * math.Pi // 0 >> 2Pi
	delta := f.AltitudeMax - f.AltitudeMin

	return flightDataPoint{
		time:     t,
		lat:      f.CenterLat + math.Sin(rad)*f.Radius,
		lng:      f.CenterLng + math.Cos(rad)*f.Radius,
		heading:  (rad * 180) / math.Pi,         // (math.Atanh(rad) * 180.0) / math.Pi, // in degrees
		altitude: f.AltitudeMin + (delta * per), // clif
	}
}
