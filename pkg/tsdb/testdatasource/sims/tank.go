package sims

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type tankSim struct {
	key   simulationKey
	cfg   tankConfig
	state tankState
}

var (
	_ Simulation = (*tankSim)(nil)
)

type tankConfig struct {
	TankCapacity float64 `json:"tankCapacity"` // size (in gallons) of the tank
	FillRate     float64 `json:"fillRate"`     // fillRate
	DrainRate    float64 `json:"drainRate"`    // how fast it will drain (when valve is open)
	DrainOpen    bool    `json:"drainOpen"`
	PumpOn       bool    `json:"pumpOn"`
}

type tankState struct {
	Time        time.Time
	FillPercent float64 // 0-1
}

func (s *tankSim) GetState() simulationState {
	return simulationState{
		Key:    s.key,
		Config: s.cfg,
	}
}

func (s *tankSim) SetConfig(vals map[string]interface{}) error {
	return updateConfigObjectFromJSON(&s.cfg, vals)
}

func (s *tankSim) NewFrame(size int) *data.Frame {
	frame := data.NewFrameOfFieldTypes("", size,
		data.FieldTypeTime,    // time
		data.FieldTypeFloat64, // value
		data.FieldTypeFloat64, // value
		data.FieldTypeBool,
		data.FieldTypeBool,
	)

	var min data.ConfFloat64 = 0.0
	var max data.ConfFloat64 = 1.0

	frame.Fields[0].Name = "time"
	frame.Fields[1].Name = "percentFull"
	frame.Fields[1].Config = &data.FieldConfig{
		Unit: "percentunit",
		Min:  &min,
		Max:  &max,
	}

	frame.Fields[2].Name = "tankVolume"
	frame.Fields[2].Config = &data.FieldConfig{
		Unit: "m3", // cubic meters
	}
	frame.Fields[3].Name = "pumpOn"
	frame.Fields[4].Name = "drainOpen"
	return frame
}

func (s *tankSim) GetValues(t time.Time) map[string]interface{} {
	if t.Before(s.state.Time) {
		return nil // can not look backwards!
	}
	if t.After(s.state.Time) {
		elapsed := t.Sub(s.state.Time).Seconds()
		v := s.state.FillPercent * s.cfg.TankCapacity
		if s.cfg.PumpOn {
			v += (elapsed * s.cfg.FillRate)
		}
		if s.cfg.DrainOpen {
			v -= (elapsed * s.cfg.DrainRate)
		}

		p := v / s.cfg.TankCapacity
		if p > 1 {
			p = 1
		} else if p < 0 {
			p = 0
		}

		s.state.FillPercent = p
		s.state.Time = t
	}

	return map[string]interface{}{
		"time":        s.state.Time,
		"percentFull": s.state.FillPercent,
		"tankVolume":  s.state.FillPercent * s.cfg.TankCapacity,
		"pumpOn":      s.cfg.PumpOn,
		"drainOpen":   s.cfg.DrainOpen,
	}
}

func (s *tankSim) Close() error {
	return nil
}

func newTankSimInfo() simulationInfo {
	tc := tankConfig{
		TankCapacity: 100.0,
		FillRate:     1.0, // gallons/min?
		DrainRate:    0.5, // `json:"drainRate,omitempty"` // how fast it will drain (when valve is open)
		DrainOpen:    false,
		PumpOn:       true,
	}
	ts := tankState{
		Time:        time.Now(),
		FillPercent: .6,
	}

	df := data.NewFrame("")
	df.Fields = append(df.Fields, data.NewField("tankCapacity", nil, []float64{tc.TankCapacity}).SetConfig(&data.FieldConfig{
		Unit: "m3",
	}))
	df.Fields = append(df.Fields, data.NewField("fillRate", nil, []float64{tc.FillRate}).SetConfig(&data.FieldConfig{
		Unit: "cms",
	}))
	df.Fields = append(df.Fields, data.NewField("drainRate", nil, []float64{tc.DrainRate}).SetConfig(&data.FieldConfig{
		Unit: "cms",
	}))
	df.Fields = append(df.Fields, data.NewField("drainOpen", nil, []bool{tc.DrainOpen}))
	df.Fields = append(df.Fields, data.NewField("pumpOn", nil, []bool{tc.PumpOn}))

	return simulationInfo{
		Type:         "tank",
		Name:         "Tank",
		Description:  "Fill and drain a water tank",
		ConfigFields: df,
		OnlyForward:  false,
		create: func(cfg simulationState) (Simulation, error) {
			s := &tankSim{
				key:   cfg.Key,
				cfg:   tc,
				state: ts,
			}
			err := updateConfigObjectFromJSON(&s.cfg, cfg.Config) // override any fields
			return s, err
		},
	}
}
