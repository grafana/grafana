package builders

import (
	"github.com/grafana/grafana-app-sdk/app"

	iam "github.com/grafana/grafana/apps/iam/pkg/apis"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// iamManifests is the slice the IAM builders pass to the standard document
// builder. It carries the selectable-field declarations the builder uses to
// populate IndexableDocument.SelectableFields for IAM kinds.
var iamManifests = []app.Manifest{iam.LocalManifest()}

// iamProvider is shared by all IAM builders and their exported field sets, so
// the manifest is parsed once.
var iamProvider = resource.NewManifestBackedProvider(iamManifests)

const (
	USER_EMAIL                 = "email"
	USER_LOGIN                 = "login"
	USER_LAST_SEEN_AT          = "lastSeenAt"
	USER_ROLE                  = "role"
	USER_DISABLED              = "disabled"
	USER_EXTERNAL_AUTH_MODULES = "externalAuthModules"
)

// UserSortableExtraFields are the additional fields that can be used for sorting user search results.
// Should not include standard fields like title.
var UserSortableExtraFields = []string{
	USER_EMAIL,
	USER_LOGIN,
	USER_LAST_SEEN_AT,
}

// UserSearchFields are read from the generated IAM manifest (declared in
// apps/iam/kinds/user.cue).
//
// lastSeenAt (int64) and disabled (boolean) declare the filter capability to
// record that they are meant to be filterable and to drive the bleve mapping
// (numeric / boolean under dynamic mapping). End-to-end numeric and boolean
// equality filters in ResourceSearchRequest are still a follow-up: the query
// path treats filter values as strings, so a request against these fields
// would not match a numeric-indexed term yet. No in-tree client filters by
// lastSeenAt or disabled today, so this is a known gap rather than a rollout
// concern.
//
// Exported for the IAM legacy SQL search backend; do not mutate.
var UserSearchFields = iamProvider.Fields(iamv0.UserResourceInfo.GroupVersionResource())

func GetUserBuilder(registry *resource.SearchFieldsRegistry) (resource.DocumentBuilderInfo, error) {
	return iamBuilder(registry, iamv0.UserResourceInfo)
}
