package supportbundles

import "context"

type SupportItem struct {
	Filename  string
	FileBytes []byte
}

type State string

const (
	StatePending  State = "pending"
	StateComplete State = "complete"
	StateError    State = "error"
	StateTimeout  State = "timeout"
)

func (s State) String() string {
	return string(s)
}

type Bundle struct {
	UID       string `json:"uid"`
	State     State  `json:"state"`
	Creator   string `json:"creator"`
	CreatedAt int64  `json:"createdAt"`
	ExpiresAt int64  `json:"expiresAt"`
	TarBytes  []byte `json:"tarBytes,omitempty"`
}

type CollectorFunc func(context.Context) (*SupportItem, error)

type Collector struct {
	// UID is a unique identifier for the collector.
	UID string `json:"uid"`
	// DisplayName is the name of the collector. User facing.
	DisplayName string `json:"displayName"`
	// Description is a description of the collector. User facing.
	Description string `json:"description"`
	// IncludedByDefault determines if the collector is included by default.
	// User cannot override this.
	IncludedByDefault bool `json:"includedByDefault"`
	// Default determines if the collector is included by default.
	// User can override this.
	Default bool `json:"default"`
	// Fn is the function that collects the support item.
	Fn CollectorFunc `json:"-"`
}

type Service interface {
	RegisterSupportItemCollector(collector Collector)
}
