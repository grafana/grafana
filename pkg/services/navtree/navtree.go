package navtree

import (
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	pref "github.com/grafana/grafana/pkg/services/preference"
)

type Service interface {
	GetNavTree(c *contextmodel.ReqContext, prefs *pref.Preference) (*NavTreeRoot, error)
}
