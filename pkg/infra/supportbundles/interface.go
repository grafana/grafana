package supportbundles

import "context"

type Service interface {
	CreateSupportBundle(context.Context) error
	ListSupportBundles()
	RetrieveSupportBundle()
}
