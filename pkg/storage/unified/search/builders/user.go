package builders

import (
	"slices"

	"github.com/grafana/grafana-app-sdk/app"

	iam "github.com/grafana/grafana/apps/iam/pkg/apis"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// iamManifests is the slice the IAM builders pass to the standard document
// builder. It carries the selectable-field declarations the builder uses to
// populate IndexableDocument.SelectableFields for IAM kinds.
var iamManifests = []app.Manifest{iam.LocalManifest()}

const (
	USER_EMAIL        = "email"
	USER_LOGIN        = "login"
	USER_LAST_SEEN_AT = "lastSeenAt"
	USER_ROLE         = "role"
	USER_DISABLED     = "disabled"
	USER_CREATED      = "createdAt"
)

// UserSortableExtraFields are the additional fields that can be used for sorting user search results.
// Should not include standard fields like title.
var UserSortableExtraFields = []string{
	USER_EMAIL,
	USER_LOGIN,
	USER_LAST_SEEN_AT,
}

// userSearchFields are read from the generated IAM manifest (declared in
// apps/iam/kinds/user.cue), plus the createdAt field appended below.
//
// lastSeenAt (int64) and disabled (boolean) declare the filter capability to
// record that they are meant to be filterable and to drive the bleve mapping
// (numeric / boolean under dynamic mapping). End-to-end numeric and boolean
// equality filters in ResourceSearchRequest are still a follow-up: the query
// path treats filter values as strings, so a request against these fields
// would not match a numeric-indexed term yet. No in-tree client filters by
// lastSeenAt or disabled today, so this is a known gap rather than a rollout
// concern.
var userSearchFields = slices.Concat(
	resource.NewManifestBackedProvider(iamManifests).Fields(iamv0.UserResourceInfo.GroupVersionResource()),
	[]resource.SearchFieldDefinition{
		// createdAt reads from the standard document's Created value rather than a
		// resource path, so it cannot be declared in the manifest and stays here.
		// It mirrors that value into the per-kind fields.* sub-document because
		// the top-level created field has no bleve mapping today.
		{Name: USER_CREATED, CopyFromStandard: resource.StandardFieldCreated, Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityRetrieve}, Description: "The creation timestamp of the user, in epoch milliseconds"},
	},
)

// UserTableColumnDefinitions exposes column-defs by name for wire-API
// consumers (the IAM legacy SQL backend in user/legacy_search.go).
// Derived from userSearchFields via tableColumnsByName. UniqueValues was
// set on the historical hand-written email/login entries but has no
// production consumer and is not preserved.
var UserTableColumnDefinitions = tableColumnsByName(userSearchFields)

func GetUserBuilder() (resource.DocumentBuilderInfo, error) {
	return iamBuilder(iamv0.UserResourceInfo, userSearchFields)
}
