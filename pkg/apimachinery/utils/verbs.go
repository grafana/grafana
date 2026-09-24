package utils

// Kubernetes request verbs
// http://kubernetes.io/docs/reference/access-authn-authz/authorization/#request-verb-resource
const (
	// VerbGet is mapped from HTTP GET for individual resource
	VerbGet = "get"
	// VerbList is mapped from HTTP GET for collections
	VerbList = "list"
	// VerbWatch is mapped from HTTP GET for watching an individual resource or collection of resources
	VerbWatch = "watch"
	// VerbCreate is mapped from HTTP POST
	VerbCreate = "create"
	// VerbUpdate is mapped from HTTP PUT
	VerbUpdate = "update"
	// VerbPatch is mapped from HTTP PATCH
	VerbPatch = "patch"
	// VerbDelete is mapped from HTTP DELETE for individual resources
	VerbDelete = "delete"
	// VerbDelete is mapped from HTTP DELETE for collections
	VerbDeleteCollection = "deletecollection"
	// VerbGetPermissions is used when fetching resource specific permissions
	VerbGetPermissions = "get_permissions"
	// VerbSetPermissions is used when setting resource specific permissions
	VerbSetPermissions = "set_permissions"
)

// ListKeysPathSegment is the final segment of the list-keys endpoint. Kubernetes
// parses a POST to it as a create on an object of that name, so the authorization
// chain and the route that serves it both need the literal.
const ListKeysPathSegment = "list-keys"

// validVerbs is the set of Kubernetes request verbs Grafana recognizes.
var validVerbs = map[string]struct{}{
	VerbGet:              {},
	VerbList:             {},
	VerbWatch:            {},
	VerbCreate:           {},
	VerbUpdate:           {},
	VerbPatch:            {},
	VerbDelete:           {},
	VerbDeleteCollection: {},
	VerbGetPermissions:   {},
	VerbSetPermissions:   {},
}

// IsValidVerb reports whether verb is a recognized Kubernetes request verb.
func IsValidVerb(verb string) bool {
	_, ok := validVerbs[verb]
	return ok
}
