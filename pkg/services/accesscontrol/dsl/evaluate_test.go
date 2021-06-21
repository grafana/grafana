package dsl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type evaluateTestCase struct {
	desc        string
	toEval      accesscontrol.Eval
	expected    bool
	permissions []*accesscontrol.Permission
}

func TestEvaluate(t *testing.T) {
	tests := []evaluateTestCase{
		{
			desc:     "expect to evaluate to true",
			expected: true,
			toEval:   Permission("settings:write", "settings:auth.saml:enabled"),
			permissions: []*accesscontrol.Permission{
				{
					Action: "settings:write",
					Scope:  "settings:**",
				},
				{
					Action: "settings:read",
					Scope:  "settings:auth.saml:*",
				},
				{
					Action: "datasources:explore",
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			ac := &fakeAccessControl{permissions: test.permissions}
			ok, err := Evaluate(context.Background(), ac, &models.SignedInUser{}, test.toEval)
			assert.NoError(t, err)
			assert.True(t, ok)
		})
	}
}

var _ accesscontrol.AccessControl = new(fakeAccessControl)

type fakeAccessControl struct {
	permissions []*accesscontrol.Permission
}

func (f *fakeAccessControl) Evaluate(ctx context.Context, user *models.SignedInUser, eval accesscontrol.Eval) (bool, error) {
	return Evaluate(ctx, f, user, eval)
}

func (f *fakeAccessControl) GetUserPermissions(ctx context.Context, user *models.SignedInUser) ([]*accesscontrol.Permission, error) {
	return f.permissions, nil
}

func (f *fakeAccessControl) IsDisabled() bool {
	return false
}
