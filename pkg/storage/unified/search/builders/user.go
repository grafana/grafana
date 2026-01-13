package builders

import (
	"bytes"
	"context"
	"encoding/json"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	USER_EMAIL        = "email"
	USER_LOGIN        = "login"
	USER_LAST_SEEN_AT = "lastSeenAt"
	USER_ROLE         = "role"
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
}

func GetUserBuilder() (resource.DocumentBuilderInfo, error) {
	values := make([]*resourcepb.ResourceTableColumnDefinition, 0, len(UserTableColumnDefinitions))
	for _, v := range UserTableColumnDefinitions {
		values = append(values, v)
	}
	fields, err := resource.NewSearchableDocumentFields(values)
	return resource.DocumentBuilderInfo{
		GroupResource: iamv0.UserResourceInfo.GroupResource(),
		Fields:        fields,
		Builder:       new(userDocumentBuilder),
	}, err
}

var _ resource.DocumentBuilder = new(userDocumentBuilder)

type userDocumentBuilder struct{}

func (u *userDocumentBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*resource.IndexableDocument, error) {
	user := &iamv0.User{}
	err := json.NewDecoder(bytes.NewReader(value)).Decode(user)
	if err != nil {
		return nil, err
	}

	obj, err := utils.MetaAccessor(user)
	if err != nil {
		return nil, err
	}

	doc := resource.NewIndexableDocument(key, rv, obj)

	doc.Fields = make(map[string]any)
	if user.Spec.Email != "" {
		doc.Fields[USER_EMAIL] = user.Spec.Email
	}
	if user.Spec.Login != "" {
		doc.Fields[USER_LOGIN] = user.Spec.Login
	}
	doc.Fields[USER_LAST_SEEN_AT] = user.Status.LastSeenAt
	doc.Fields[USER_ROLE] = user.Spec.Role

	return doc, nil
}
