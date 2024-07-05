package zanzana

import (
	"fmt"
	"strconv"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

const (
	TypeUser string = "user"
	TypeTeam string = "team"
)

const (
	RelationTeamMember string = "member"
	RelationTeamAdmin  string = "admin"
)

func NewObject(typ, id string) string {
	return fmt.Sprintf("%s:%s", typ, id)
}

func NewScopedObject(typ, id, scope string) string {
	return NewObject(typ, fmt.Sprintf("%s-%s", scope, id))
}

// rbac action to relation translation
var actionTranslations = map[string]string{}

type kindTranslation struct {
	typ       string
	orgScoped bool
}

// all kinds that we can translate into a openFGA object
var kindTranslations = map[string]kindTranslation{}

func TranslateToTuple(user string, action, kind, identifier string, orgID int64) (*openfgav1.TupleKey, bool) {
	relation, ok := actionTranslations[action]
	if !ok {
		return nil, false
	}

	t, ok := kindTranslations[kind]
	if !ok {
		return nil, false
	}

	tuple := &openfgav1.TupleKey{
		Relation: relation,
	}

	tuple.User = user
	tuple.Relation = relation

	// Some uid:s in grafana are not guarantee to be unique across orgs so we need to scope them.
	if t.orgScoped {
		tuple.Object = NewScopedObject(t.typ, identifier, strconv.FormatInt(orgID, 10))
	} else {
		tuple.Object = NewObject(t.typ, identifier)
	}

	return tuple, true
}

// CheckAvailableAction return true if check can be performed on specific action
func CheckAvailableAction(action string) bool {
	_, ok := actionTranslations[action]
	return ok
}
