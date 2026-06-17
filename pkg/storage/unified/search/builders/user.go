package builders

import (
	"github.com/grafana/grafana-app-sdk/app"
	"k8s.io/apimachinery/pkg/runtime/schema"

	iam "github.com/grafana/grafana/apps/iam/pkg/apis"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
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

var UserTableColumnDefinitions = map[string]*resourcepb.ResourceTableColumnDefinition{
	USER_EMAIL: {
		Name:        USER_EMAIL,
		Type:        resourcepb.ResourceTableColumnDefinition_STRING,
		Description: "The email address of the user",
		Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
			UniqueValues: true,
			Filterable:   true,
		},
	},
	USER_LOGIN: {
		Name:        USER_LOGIN,
		Type:        resourcepb.ResourceTableColumnDefinition_STRING,
		Description: "The login of the user",
		Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
			UniqueValues: true,
			Filterable:   true,
		},
	},
	USER_LAST_SEEN_AT: {
		Name:        USER_LAST_SEEN_AT,
		Type:        resourcepb.ResourceTableColumnDefinition_INT64,
		Description: "The last seen timestamp of the user",
		Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
			Filterable: true,
		},
	},
	USER_ROLE: {
		Name:        USER_ROLE,
		Type:        resourcepb.ResourceTableColumnDefinition_STRING,
		Description: "The role of the user",
		Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
			Filterable: true,
		},
	},
	USER_DISABLED: {
		Name:        USER_DISABLED,
		Type:        resourcepb.ResourceTableColumnDefinition_BOOLEAN,
		Description: "Whether the user is disabled",
		Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
			Filterable: true,
		},
	},
	USER_CREATED: {
		Name:        USER_CREATED,
		Type:        resourcepb.ResourceTableColumnDefinition_INT64,
		Description: "The creation timestamp of the user, in epoch milliseconds",
	},
}

// UserSearchFields declares paths and types for each user search field. The
// standard document builder uses these to extract spec/status values from the
// raw JSON, avoiding a custom builder.
//
// lastSeenAt and disabled set EmitZeroIfAbsent so every indexed user document
// carries those fields. The user-search API sorts on lastSeenAt and missing
// values would otherwise sort last, putting never-seen users in a different
// position than the historical "sort by epoch 0" behaviour.
//
// createdAt mirrors the standard IndexableDocument.Created field into the
// per-kind fields.* sub-document because the top-level created field has no
// bleve mapping today. See PR #126405 for context.
var UserSearchFields = []resource.SearchFieldDefinition{
	{Name: USER_EMAIL, Path: "spec.email", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}},
	{Name: USER_LOGIN, Path: "spec.login", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}},
	{Name: USER_LAST_SEEN_AT, Path: "status.lastSeenAt", Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, EmitZeroIfAbsent: true},
	{Name: USER_ROLE, Path: "spec.role", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}},
	{Name: USER_DISABLED, Path: "spec.disabled", Type: resource.SearchFieldTypeBoolean, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, EmitZeroIfAbsent: true},
	{Name: USER_CREATED, CopyFromStandard: resource.StandardFieldCreated, Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityRetrieve}},
}

func GetUserBuilder() (resource.DocumentBuilderInfo, error) {
	values := make([]*resourcepb.ResourceTableColumnDefinition, 0, len(UserTableColumnDefinitions))
	for _, v := range UserTableColumnDefinitions {
		values = append(values, v)
	}
	fields, err := resource.NewSearchableDocumentFields(values)
	if err != nil {
		return resource.DocumentBuilderInfo{}, err
	}

	gvr := iamv0.UserResourceInfo.GroupVersionResource()
	provider := resource.NewMapProvider(
		map[schema.GroupVersionResource][]resource.SearchFieldDefinition{
			gvr: UserSearchFields,
		},
		// Documents stored without an explicit apiVersion fall back to the
		// served version so extraction still happens for legacy payloads.
		map[schema.GroupResource]string{
			gvr.GroupResource(): gvr.Version,
		},
	)

	return resource.DocumentBuilderInfo{
		GroupResource: iamv0.UserResourceInfo.GroupResource(),
		Fields:        fields,
		Builder:       resource.StandardDocumentBuilderWithFields(iamManifests, provider),
	}, nil
}
