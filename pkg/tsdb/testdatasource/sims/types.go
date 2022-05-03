package sims

import (
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type simulationKey struct {
	Type   string  `json:"type"`
	TickHZ float64 `json:"tick"`          // events/second
	UID    string  `json:"uid,omitempty"` // allows many instances of the same type
}

func (k simulationKey) String() string {
	hz := strings.TrimRight(strings.TrimRight(fmt.Sprintf("%.2f", k.TickHZ), "0"), ".")
	if k.UID != "" {
		return fmt.Sprintf("%s/%shz/%s", k.Type, hz, k.UID)
	}
	return fmt.Sprintf("%s/%shz", k.Type, hz)
}

type simulationState struct {
	// Identify the simulation instance
	Key simulationKey `json:"key"`

	// Saved in panel options, and used to set initial values
	Config interface{} `json:"config"`
}

type simulationInfo struct {
	Type         string      `json:"type"`
	Name         string      `json:"name"`
	Description  string      `json:"description"`
	OnlyForward  bool        `json:"forward"`
	ConfigFields *data.Frame `json:"config"`

	// Create a simulation instance
	create func(q simulationState) (Simulation, error)
}

type Simulation interface {
	io.Closer
	GetState() simulationState
	SetConfig(vals map[string]interface{}) error
	NewFrame(size int) *data.Frame
	GetValues(t time.Time) map[string]interface{}
}
