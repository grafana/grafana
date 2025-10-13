package search

import (
	"context"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

const (
	USER_EMAIL = "email"
	USER_LOGIN = "login"
)

func GetUserBuilder() (resource.DocumentBuilderInfo, error) {
	fields, err := resource.NewSearchableDocumentFields([]*resourcepb.ResourceTableColumnDefinition{
		{
			Name:        USER_EMAIL,
			Type:        resourcepb.ResourceTableColumnDefinition_STRING,
			Description: "The email address of the user",
			Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
				Filterable: true,
			},
		},
		{
			Name:        USER_LOGIN,
			Type:        resourcepb.ResourceTableColumnDefinition_STRING,
			Description: "The login of the user",
			Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
				UniqueValues: true,
				Filterable:   true,
			},
		},
	})
	return resource.DocumentBuilderInfo{
		GroupResource: iamv0.UserResourceInfo.GroupResource(),
		Fields:        fields,
		Builder:       new(userDocumentBuilder),
	}, err
}

var _ resource.DocumentBuilder = new(userDocumentBuilder)

type userDocumentBuilder struct{}

// BuildDocument implements resource.DocumentBuilder.
func (u *userDocumentBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*resource.IndexableDocument, error) {
	tmp := &unstructured.Unstructured{}
	err := tmp.UnmarshalJSON(value)
	if err != nil {
		return nil, err
	}

	obj, err := utils.MetaAccessor(tmp)
	if err != nil {
		return nil, err
	}

	doc := resource.NewIndexableDocument(key, rv, obj)

	if spec, err := obj.GetSpec(); err == nil {
		if m, ok := spec.(map[string]any); ok {
			email, _ := m[USER_EMAIL].(string)
			login, _ := m[USER_LOGIN].(string)
			if email != "" || login != "" {
				doc.Fields = make(map[string]any)
				if email != "" {
					doc.Fields[USER_EMAIL] = email
				}
				if login != "" {
					doc.Fields[USER_LOGIN] = login
				}
			}
		}
	}
	return doc, nil
}
