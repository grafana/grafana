package models

// ReceiverGroupQuery represents a query for receiver groups.
type ReceiverGroupQuery struct {
	OrgID   int64
	Names   []string
	Limit   int
	Offset  int
	Decrypt bool
}
