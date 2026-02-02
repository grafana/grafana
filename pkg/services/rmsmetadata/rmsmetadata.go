package rmsmetadata

import "context"

type Service interface {
	// DB Operations
	GetViewList(context.Context, int64) ([]*View, error)
	GetViewById(context.Context, int64, int64) (*View, error)
	GetViewsEnabledForInsightFinder(context.Context, int64) (*ViewsEnabledForInsightFinder, error)
	SetViewsEnabledForInsightFinder(context.Context, int64, *ViewsEnabledForInsightFinder) error

	// RMS Operations
	Get(url string, headers map[string]string, queryParamsMap map[string]string) ([]byte, error)
	Post(url string, headers map[string]string, queryParamsMap map[string]string, data []byte) ([]byte, error)
	Delete(url string, headers map[string]string, queryParamsMap map[string]string) error
}
