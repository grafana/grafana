package supportbundles

import "context"

type SupportItem struct {
	Filename  string
	FileBytes []byte
}

type Bundle struct {
	UID         string
	FilePath    string
	Creator     string
	RequestedAt int64
	ExpiresAt   int64
}

type CollectorFunc func(context.Context) (*SupportItem, error)
type Service interface {
	CreateSupportBundle(context.Context) (string, error)
	ListSupportBundles() ([]Bundle, error)
	RetrieveSupportBundle(string) (*Bundle, error)
	RegisterSupportItemCollector(CollectorFunc)
}
