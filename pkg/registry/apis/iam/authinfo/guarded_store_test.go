package authinfo

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/fields"
)

func TestRequireListSelector(t *testing.T) {
	tests := []struct {
		name     string
		options  *internalversion.ListOptions
		wantFail bool
	}{
		{name: "nil options", options: nil, wantFail: true},
		{name: "no selector", options: &internalversion.ListOptions{}, wantFail: true},
		{name: "unrelated selector", options: &internalversion.ListOptions{FieldSelector: fields.OneTermEqualSelector("spec.authModule", "ldap")}, wantFail: true},
		{name: "userRef selector", options: &internalversion.ListOptions{FieldSelector: fields.OneTermEqualSelector("spec.userRef.name", "u1")}},
		{name: "authID selector", options: &internalversion.ListOptions{FieldSelector: fields.OneTermEqualSelector("spec.authID", "a1")}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := requireListSelector(tt.options)
			if tt.wantFail {
				require.True(t, apierrors.IsBadRequest(err), "got %v", err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestGuardedStoreDeleteCollection(t *testing.T) {
	_, err := (&GuardedStore{}).DeleteCollection(nil, nil, nil, nil) //nolint:staticcheck
	require.True(t, apierrors.IsMethodNotSupported(err), "got %v", err)
}

func TestRequireWatchSelector(t *testing.T) {
	tests := []struct {
		name     string
		options  *internalversion.ListOptions
		wantFail bool
	}{
		{name: "nil options", options: nil, wantFail: true},
		{name: "no selector", options: &internalversion.ListOptions{}, wantFail: true},
		{name: "unrelated selector", options: &internalversion.ListOptions{FieldSelector: fields.OneTermEqualSelector("spec.authModule", "ldap")}, wantFail: true},
		{name: "userRef selector", options: &internalversion.ListOptions{FieldSelector: fields.OneTermEqualSelector("spec.userRef.name", "u1")}},
		{name: "authID selector", options: &internalversion.ListOptions{FieldSelector: fields.OneTermEqualSelector("spec.authID", "a1")}},
		{name: "metadata.name selector", options: &internalversion.ListOptions{FieldSelector: fields.OneTermEqualSelector("metadata.name", "u1.ldap")}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := requireWatchSelector(tt.options)
			if tt.wantFail {
				require.True(t, apierrors.IsBadRequest(err), "got %v", err)
				require.Contains(t, err.Error(), "watching authinfo")
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestRequireListSelectorRejectsMetadataName(t *testing.T) {
	err := requireListSelector(&internalversion.ListOptions{FieldSelector: fields.OneTermEqualSelector("metadata.name", "u1.ldap")})
	require.True(t, apierrors.IsBadRequest(err), "got %v", err)
}

func TestGuardedStoreWatchRequiresSelector(t *testing.T) {
	_, err := (&GuardedStore{}).Watch(context.Background(), &internalversion.ListOptions{})
	require.True(t, apierrors.IsBadRequest(err), "got %v", err)
}
