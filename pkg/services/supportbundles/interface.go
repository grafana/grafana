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
	UID               string        `json:"uid"`
	DisplayName       string        `json:"displayName"`
	Description       string        `json:"description"`
	IncludedByDefault bool          `json:"includedByDefault"`
	Default           bool          `json:"default"`
	Fn                CollectorFunc `json:"-"`
}

type Service interface {
	RegisterSupportItemCollector(collector Collector)
}
