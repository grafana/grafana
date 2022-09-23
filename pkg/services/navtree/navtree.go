package navtree

import (
	"github.com/grafana/grafana/pkg/models"
	pref "github.com/grafana/grafana/pkg/services/preference"
)

type Service interface {
	GetNavTree(c *models.ReqContext, hasEditPerm bool, prefs *pref.Preference) ([]*NavLink, error)
}
