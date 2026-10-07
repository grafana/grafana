package accesscontrol

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/merge"
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

func TestAlertmanagerImportsAccess_AuthorizePromote(t *testing.T) {
	testCases := []struct {
		name        string
		permissions []ac.Permission
		result      merge.MergeResult
		expectedErr bool
	}{
		{
			name:        "no resources succeeds without any permissions",
			result:      merge.MergeResult{},
			expectedErr: false,
		},
		{
			name:        "HasReceivers with receivers:create succeeds",
			permissions: []ac.Permission{{Action: ac.ActionAlertingReceiversCreate}},
			result:      merge.MergeResult{AddedReceivers: []string{"x"}},
			expectedErr: false,
		},
		{
			name:        "HasReceivers without receivers:create fails",
			result:      merge.MergeResult{AddedReceivers: []string{"x"}},
			expectedErr: true,
		},
		{
			name:        "HasRoutes with routes:create succeeds",
			permissions: []ac.Permission{{Action: ac.ActionAlertingManagedRoutesCreate}},
			result:      merge.MergeResult{AddedRoute: "x"},
			expectedErr: false,
		},
		{
			name:        "HasRoutes without routes:create fails",
			result:      merge.MergeResult{AddedRoute: "x"},
			expectedErr: true,
		},
		{
			name:        "HasTemplates with templates:write succeeds",
			permissions: []ac.Permission{{Action: ac.ActionAlertingNotificationsTemplatesWrite}},
			result:      merge.MergeResult{AddedTemplates: []string{"x"}},
			expectedErr: false,
		},
		{
			name:        "HasTemplates without templates:write fails",
			result:      merge.MergeResult{AddedTemplates: []string{"x"}},
			expectedErr: true,
		},
		{
			name:        "HasTimeIntervals with time-intervals:write succeeds",
			permissions: []ac.Permission{{Action: ac.ActionAlertingNotificationsTimeIntervalsWrite}},
			result:      merge.MergeResult{AddedTimeIntervals: []string{"x"}},
			expectedErr: false,
		},
		{
			name:        "HasTimeIntervals without time-intervals:write fails",
			result:      merge.MergeResult{AddedTimeIntervals: []string{"x"}},
			expectedErr: true,
		},
		{
			name:        "HasInhibitionRules with inhibition-rules:write succeeds",
			permissions: []ac.Permission{{Action: ac.ActionAlertingNotificationsInhibitionRulesWrite}},
			result:      merge.MergeResult{AddedInhibitionRules: []string{"x"}},
			expectedErr: false,
		},
		{
			name:        "HasInhibitionRules without inhibition-rules:write fails",
			result:      merge.MergeResult{AddedInhibitionRules: []string{"x"}},
			expectedErr: true,
		},
		{
			name: "all resources with all permissions succeeds",
			permissions: []ac.Permission{
				{Action: ac.ActionAlertingReceiversCreate},
				{Action: ac.ActionAlertingManagedRoutesCreate},
				{Action: ac.ActionAlertingNotificationsTemplatesWrite},
				{Action: ac.ActionAlertingNotificationsTimeIntervalsWrite},
				{Action: ac.ActionAlertingNotificationsInhibitionRulesWrite},
			},
			result:      merge.MergeResult{AddedReceivers: []string{"x"}, AddedRoute: "x", AddedTemplates: []string{"x"}, AddedTimeIntervals: []string{"x"}, AddedInhibitionRules: []string{"x"}},
			expectedErr: false,
		},
		{
			name: "all resources with one permission missing fails",
			permissions: []ac.Permission{
				{Action: ac.ActionAlertingReceiversCreate},
				{Action: ac.ActionAlertingManagedRoutesCreate},
				{Action: ac.ActionAlertingNotificationsTemplatesWrite},
				{Action: ac.ActionAlertingNotificationsTimeIntervalsWrite},
			},
			result:      merge.MergeResult{AddedReceivers: []string{"x"}, AddedRoute: "x", AddedTemplates: []string{"x"}, AddedTimeIntervals: []string{"x"}, AddedInhibitionRules: []string{"x"}},
			expectedErr: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			fake := &recordingAccessControlFake{}
			svc := NewAlertmanagerImportsAccess(fake)
			err := svc.AuthorizePromote(context.Background(), newUser(tc.permissions...), tc.result)
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
