package navlinks

import "github.com/grafana/grafana/pkg/api/dtos"

func GetServerAdminNode(children []*dtos.NavLink) *dtos.NavLink {
	url := ""
	if len(children) > 0 {
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

func FindById(nodes []*dtos.NavLink, id string) *dtos.NavLink {
	for _, child := range nodes {
		if child.Id == id {
			return child
		} else if len(child.Children) > 0 {
			found := FindById(child.Children, id)
			if found != nil {
				return found
			}
		}
	}

	return nil
}
