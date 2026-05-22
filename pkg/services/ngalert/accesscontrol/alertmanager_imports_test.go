package accesscontrol

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestAlertmanagerImportsAccess_AuthorizeCreate(t *testing.T) {
	testCases := []struct {
		name        string
		permissions []ac.Permission
		expectedErr bool
	}{
		{
			name:        "with create permission succeeds",
			permissions: []ac.Permission{{Action: ac.ActionAlertingAlertmanagerImportsCreate}},
			expectedErr: false,
		},
		{
			name:        "with only notifications:write fails — no legacy fallback for create",
			permissions: []ac.Permission{{Action: ac.ActionAlertingNotificationsWrite}},
			expectedErr: true,
		},
		{
			name:        "with no permissions fails",
			permissions: []ac.Permission{},
			expectedErr: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			fake := &recordingAccessControlFake{}
			svc := NewAlertmanagerImportsAccess(fake)
			err := svc.AuthorizeCreate(context.Background(), newUser(tc.permissions...))
			if tc.expectedErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestAlertmanagerImportsAccess_AuthorizeUpdate(t *testing.T) {
	identifier := "test-import"
	otherIdentifier := "other-import"

	testCases := []struct {
		name        string
		permissions []ac.Permission
		identifier  string
		expectedErr bool
	}{
		{
			name:        "with notifications:write (legacy) succeeds",
			permissions: []ac.Permission{{Action: ac.ActionAlertingNotificationsWrite}},
			identifier:  identifier,
			expectedErr: false,
		},
		{
			name: "with scoped write for matching identifier succeeds",
			permissions: []ac.Permission{{
				Action: ac.ActionAlertingAlertmanagerImportsWrite,
				Scope:  models.ScopeAlertmanagerImportsProvider.GetResourceScopeUID(identifier),
			}},
			identifier:  identifier,
			expectedErr: false,
		},
		{
			name: "with scoped write for different identifier fails",
			permissions: []ac.Permission{{
				Action: ac.ActionAlertingAlertmanagerImportsWrite,
				Scope:  models.ScopeAlertmanagerImportsProvider.GetResourceScopeUID(otherIdentifier),
			}},
			identifier:  identifier,
			expectedErr: true,
		},
		{
			name:        "with no permissions fails",
			permissions: []ac.Permission{},
			identifier:  identifier,
			expectedErr: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			fake := &recordingAccessControlFake{}
			svc := NewAlertmanagerImportsAccess(fake)
			err := svc.AuthorizeUpdate(context.Background(), newUser(tc.permissions...), tc.identifier)
			if tc.expectedErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestAlertmanagerImportsAccess_AuthorizeDelete(t *testing.T) {
	identifier := "test-import"
	otherIdentifier := "other-import"

	testCases := []struct {
		name        string
		permissions []ac.Permission
		identifier  string
		expectedErr bool
	}{
		{
			name:        "with notifications:write (legacy) succeeds",
			permissions: []ac.Permission{{Action: ac.ActionAlertingNotificationsWrite}},
			identifier:  identifier,
			expectedErr: false,
		},
		{
			name: "with scoped delete for matching identifier succeeds",
			permissions: []ac.Permission{{
				Action: ac.ActionAlertingAlertmanagerImportsDelete,
				Scope:  models.ScopeAlertmanagerImportsProvider.GetResourceScopeUID(identifier),
			}},
			identifier:  identifier,
			expectedErr: false,
		},
		{
			name: "with scoped delete for different identifier fails",
			permissions: []ac.Permission{{
				Action: ac.ActionAlertingAlertmanagerImportsDelete,
				Scope:  models.ScopeAlertmanagerImportsProvider.GetResourceScopeUID(otherIdentifier),
			}},
			identifier:  identifier,
			expectedErr: true,
		},
		{
			name:        "with no permissions fails",
			permissions: []ac.Permission{},
			identifier:  identifier,
			expectedErr: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			fake := &recordingAccessControlFake{}
			svc := NewAlertmanagerImportsAccess(fake)
			err := svc.AuthorizeDelete(context.Background(), newUser(tc.permissions...), tc.identifier)
			if tc.expectedErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
