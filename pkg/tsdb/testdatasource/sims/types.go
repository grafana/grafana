package sims

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type SimulationConfig struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Config      *data.Frame `json:"config"`
	Running     bool        `json:"running"`
	Interval    float64     `json:"interval"` // seconds
}

type Simulation interface {
	GetConfig() SimulationConfig
	SetConfig(vals map[string]interface{}) error
	GetValues(time time.Time) *data.Frame
}
