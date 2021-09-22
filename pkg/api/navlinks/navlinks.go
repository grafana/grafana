package navlinks

import "github.com/grafana/grafana/pkg/api/dtos"

func GetServerAdminNode(children []*dtos.NavLink) *dtos.NavLink {
	return &dtos.NavLink{
		Text:         "Server Admin",
		SubTitle:     "Manage all users and orgs",
		HideFromTabs: true,
		Id:           "admin",
		Icon:         "shield",
		Url:          children[0].Url,
		SortWeight:   dtos.WeightAdmin,
		Children:     children,
	}
}
