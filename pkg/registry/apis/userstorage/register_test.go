package userstorage

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/stretchr/testify/assert"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func TestAuthorizer(t *testing.T) {
	tests := []struct {
		name        string
		requesterID string
		verb        string
		objectName  string
		decision    authorizer.Decision
	}{
		{
			name:        "valid authorization",
			requesterID: "123",
			objectName:  "user:123",
			verb:        "get",
			decision:    authorizer.DecisionAllow,
		},
		{
			name:        "invalid user",
			requesterID: "123",
			objectName:  "user:456",
			verb:        "get",
			decision:    authorizer.DecisionDeny,
		},
		{
			name:        "admin user",
			requesterID: "admin",
			objectName:  "",
			verb:        "list",
			decision:    authorizer.DecisionAllow,
		},
		{
			name:        "create request",
			requesterID: "123",
			objectName:  "",
			verb:        "create",
			decision:    authorizer.DecisionNoOpinion,
		},
		{
			name:        "forbidden action",
			requesterID: "123",
			objectName:  "",
			verb:        "list",
			decision:    authorizer.DecisionDeny,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			requester := &identity.StaticRequester{Type: "user", UserUID: tt.requesterID}
			if tt.requesterID == "admin" {
				requester.IsGrafanaAdmin = true
			}
			ctx := identity.WithRequester(context.Background(), requester)
			apiBuilder := &UserStorageAPIBuilder{}
			auth := apiBuilder.GetAuthorizer()
			at := &fakeAttributes{
				verb: tt.verb,
				name: tt.objectName,
			}
			decision, _, err := auth.Authorize(ctx, at)
			assert.NoError(t, err)
			assert.Equal(t, tt.decision, decision)
		})
	}
}

type fakeAttributes struct {
	authorizer.Attributes
	verb string
	name string
}

func (a fakeAttributes) GetVerb() string {
	return a.verb
}

func (a fakeAttributes) IsResourceRequest() bool {
	return true
}

func (a fakeAttributes) GetName() string {
	return a.name
}
