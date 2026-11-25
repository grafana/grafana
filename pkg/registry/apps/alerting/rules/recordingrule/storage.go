package recordingrule

import (
	"k8s.io/apiserver/pkg/registry/rest"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/ngalert/rules/legacy"
)

func NewStorage(rules *legacy.RecordingRules) grafanarest.Storage {
	return &legacyStorage{
		rules:          rules,
		tableConverter: rest.NewDefaultTableConvertor(ResourceInfo.GroupResource()),
	}
}
