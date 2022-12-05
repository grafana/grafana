package playlist

import "github.com/grafana/grafana/pkg/kinds/team"

func Create(labels kindsys.LabelSet, obj *team.Team) error {
	return doCreate(labels, obj)
}

func GetByUID(uid string) (*team.Team, error) {
	return getAllByLabel(labels)
}

func GetAllByLabel(labels kindsys.LabelSet) ([]*team.Team, error) {
	return getAllByLabel(labels)
}
