package models

import (
	"fmt"
	"hash/fnv"

	"github.com/grafana/alerting/notify"
)

// GetReceiverQuery represents a query for a single receiver.
type GetReceiverQuery struct {
	OrgID   int64
	Name    string
	Decrypt bool
}

// GetReceiversQuery represents a query for receiver groups.
type GetReceiversQuery struct {
	OrgID   int64
	Names   []string
	Limit   int
	Offset  int
	Decrypt bool
}

// Receiver is the domain model representation of a receiver / contact point.
type Receiver struct {
	Name         string
	Integrations []*notify.GrafanaIntegrationConfig
	Provenance   Provenance

	// InUseByRoute indicates if the receiver is used by a route.
	InUseByRoute bool

	// InUseByRule indicates if the receiver is used by a rule.
	InUseByRule bool
}

func (r Receiver) GetName() string {
	return r.Name
}

// GetUID returns the UID of the Receiver.
// Currently, the UID is a hash of the receiver name.
func (r Receiver) GetUID() string {
	return GetUIDFromNamed(r)
}

type Named interface {
	GetName() string
}

func GetUIDFromNamed(t Named) string {
	return GetUID(t.GetName())
}

func GetUID(name string) string {
	sum := fnv.New64()
	_, _ = sum.Write([]byte(name))
	return fmt.Sprintf("%016x", sum.Sum64())
}
