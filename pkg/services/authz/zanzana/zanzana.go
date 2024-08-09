package zanzana

import (
	"fmt"
	"strconv"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

const (
	TypeUser      string = "user"
	TypeTeam      string = "team"
	TypeFolder    string = "folder"
	TypeDashboard string = "dashboard"
)

const (
	RelationTeamMember string = "member"
	RelationTeamAdmin  string = "admin"
	RelationParent     string = "parent"
)

// NewTupleEntry constructs new openfga entry type:id[#relation].
// Relation allows to specify group of users (subjects) related to type:id
// (for example, team:devs#member refers to users which are members of team devs)
func NewTupleEntry(objectType, id, relation string) string {
	obj := fmt.Sprintf("%s:%s", objectType, id)
	if relation != "" {
		obj = fmt.Sprintf("%s#%s", obj, relation)
	}
	return obj
}

// NewScopedTupleEntry constructs new openfga entry type:id[#relation]
// with id prefixed by scope (usually org id)
func NewScopedTupleEntry(objectType, id, relation, scope string) string {
	return NewTupleEntry(objectType, fmt.Sprintf("%s-%s", scope, id), "")
}

func TranslateToTuple(user string, action, kind, identifier string, orgID int64) (*openfgav1.TupleKey, bool) {
	typeTranslation, ok := actionKindTranslations[kind]
	if !ok {
		return nil, false
	}

	relation, ok := typeTranslation.translations[action]
	if !ok {
		return nil, false
	}

	tuple := &openfgav1.TupleKey{
		Relation: relation,
	}

	tuple.User = user
	tuple.Relation = relation

	// Some uid:s in grafana are not guarantee to be unique across orgs so we need to scope them.
	if typeTranslation.orgScoped {
		tuple.Object = NewScopedTupleEntry(typeTranslation.objectType, identifier, "", strconv.FormatInt(orgID, 10))
	} else {
		tuple.Object = NewTupleEntry(typeTranslation.objectType, identifier, "")
	}

	return tuple, true
}
