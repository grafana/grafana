package navlinks

import "github.com/grafana/grafana/pkg/api/dtos"

func GetServerAdminNode(children []*dtos.NavLink, topnavEnabled bool) *dtos.NavLink {
	url := ""
	if topnavEnabled {
		url = "/admin"
	} else if len(children) > 0 {
		url = children[0].Url
	}

	return &dtos.NavLink{
		Text:         "Server admin",
		SubTitle:     "Manage all users and orgs",
		HideFromTabs: true,
		Id:           "admin",
		Icon:         "shield",
		Url:          url,
		SortWeight:   dtos.WeightAdmin,
		Section:      dtos.NavSectionConfig,
		Children:     children,
	}
}
