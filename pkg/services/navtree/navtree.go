package navtree

import (
	"github.com/grafana/grafana/pkg/services/contexthandler/model"
	pref "github.com/grafana/grafana/pkg/services/preference"
)

type Service interface {
	GetNavTree(c *model.ReqContext, hasEditPerm bool, prefs *pref.Preference) (*NavTreeRoot, error)
}
