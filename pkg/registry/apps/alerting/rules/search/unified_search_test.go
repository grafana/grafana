package search

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	sdkresource "github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestUnifiedBackendErrors(t *testing.T) {
	wantErr := errors.New("index unavailable")
	_, err := NewUnifiedClient(&fakeIndex{err: wantErr}).Search(t.Context(), &Query{})
	require.ErrorIs(t, err, wantErr)
	backend := NewUnifiedClient(&fakeIndex{resp: &resourcepb.ResourceSearchResponse{Error: &resourcepb.ErrorResult{Code: 403, Message: "forbidden"}}})
	_, err = backend.Search(t.Context(), &Query{})
	require.True(t, apierrors.IsForbidden(err))
	for _, tc := range []struct {
		name     string
		response *resourcepb.ResourceSearchResponse
		want     string
	}{
		{name: "unspecified format", response: &resourcepb.ResourceSearchResponse{}, want: "unsupported search result format 0"},
		{name: "table format", response: &resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_RESOURCE_TABLE}, want: "unsupported search result format 1"},
		{name: "unknown format", response: &resourcepb.ResourceSearchResponse{ResultFormat: 99}, want: "unsupported search result format 99"},
		{name: "missing key", response: &resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES, Rows: []*resourcepb.ResourceSearchRow{{}}}, want: "has no resource key"},
		{name: "nil row", response: &resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES, Rows: []*resourcepb.ResourceSearchRow{nil}}, want: "has no resource key"},
		{name: "invalid field index", response: fieldValueRows(&resourcepb.ResourceKey{Name: "a"}, nil, &resourcepb.ResourceSearchValue{StringValues: []string{"title"}}), want: "field index 0 is out of range"},
		{name: "missing scalar", response: fieldValueRows(&resourcepb.ResourceKey{Name: "a"},
			[]*resourcepb.ResourceSearchField{{Name: fieldTitle, Type: resourcepb.ResourceSearchField_STRING}}, &resourcepb.ResourceSearchValue{}), want: "scalar has 0 values"},
		{name: "nil value", response: fieldValueRows(&resourcepb.ResourceKey{Name: "a"}, nil, nil), want: "nil field value"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			result, err := NewUnifiedClient(&fakeIndex{resp: tc.response}).Search(t.Context(), &Query{Fields: []string{fieldTitle}})
			require.ErrorContains(t, err, tc.want)
			require.Nil(t, result)
		})
	}
}

func TestUnifiedBackendErrorResultCompatibility(t *testing.T) {
	result := &resourcepb.ErrorResult{
		Code: http.StatusForbidden, Reason: string(metav1.StatusReasonForbidden), Message: "search forbidden",
		Details: &resourcepb.ErrorDetails{
			Group: "rules.alerting.grafana.app", Kind: "AlertRule", Name: "rule", Uid: "rule-uid",
			Causes: []*resourcepb.ErrorCause{{Reason: "FieldValueForbidden", Field: "where", Message: "forbidden filter"}},
		},
	}
	grpcStatus, err := status.New(codes.Unknown, "transport message").WithDetails(result)
	require.NoError(t, err)
	var statusErr *apierrors.StatusError
	require.ErrorAs(t, resource.StatusError(result), &statusErr)
	want := statusErr.Status()
	for name, index := range map[string]*fakeIndex{
		"payload":      {resp: &resourcepb.ResourceSearchResponse{Error: result}},
		"grpc details": {err: grpcStatus.Err()},
	} {
		t.Run(name, func(t *testing.T) {
			h := newUnifiedHandler(index, index)
			for route, handler := range map[string]func(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error{
				"alert rules": h.SearchAlertRules, "recording rules": h.SearchRecordingRules,
			} {
				t.Run(route, func(t *testing.T) {
					rec := httptest.NewRecorder()
					err := WithAPIStatusErrorResponse(handler)(t.Context(), rec, &app.CustomRouteRequest{
						ResourceIdentifier: sdkresource.FullIdentifier{Namespace: "default"}, Body: readCloser(validBody),
					})
					require.NoError(t, err)
					require.Equal(t, int(result.Code), rec.Code, rec.Body.String())
					var got metav1.Status
					require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
					require.Equal(t, want, got)
				})
			}
		})
	}
}

func TestUnifiedBackendTransportErrors(t *testing.T) {
	ordinaryErr := errors.New("private connection failure")
	for _, tc := range []struct {
		name string
		err  error
	}{
		{name: "ordinary error", err: ordinaryErr},
		{name: "grpc unavailable", err: status.Error(codes.Unavailable, "private connection failure")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := newUnifiedHandler(&fakeIndex{err: tc.err}, &fakeIndex{})
			rec := httptest.NewRecorder()
			err := WithAPIStatusErrorResponse(h.SearchAlertRules)(t.Context(), rec, &app.CustomRouteRequest{
				ResourceIdentifier: sdkresource.FullIdentifier{Namespace: "default"}, Body: readCloser(validBody),
			})
			if errors.Is(tc.err, ordinaryErr) {
				require.Same(t, ordinaryErr, err)
			} else {
				require.Implements(t, (*apierrors.APIStatus)(nil), err)
				got := err.(apierrors.APIStatus).Status()
				require.Equal(t, int32(http.StatusServiceUnavailable), got.Code)
				require.Equal(t, http.StatusText(http.StatusServiceUnavailable), got.Message)
			}
			require.Empty(t, rec.Body.String())
		})
	}
}

func TestUnifiedBackendPreservesTypedFields(t *testing.T) {
	response := fieldValueRows(&resourcepb.ResourceKey{Name: "a"},
		[]*resourcepb.ResourceSearchField{
			{Name: fieldTitle, Type: resourcepb.ResourceSearchField_STRING},
			{Name: fieldPanelID, Type: resourcepb.ResourceSearchField_INT64},
			{Name: fieldPaused, Type: resourcepb.ResourceSearchField_BOOLEAN},
			{Name: fieldLabels, Type: resourcepb.ResourceSearchField_STRING, IsArray: true},
			{Name: fieldFor, Type: resourcepb.ResourceSearchField_STRING},
		},
		&resourcepb.ResourceSearchValue{FieldIndex: 0, StringValues: []string{"title"}},
		&resourcepb.ResourceSearchValue{FieldIndex: 1, Int64Values: []int64{9007199254740993}},
		&resourcepb.ResourceSearchValue{FieldIndex: 2, BooleanValues: []bool{false}},
		&resourcepb.ResourceSearchValue{FieldIndex: 3},
		&resourcepb.ResourceSearchValue{FieldIndex: 4, StringValues: []string{"5m"}},
	)
	response.TotalHits = 5
	backend := NewUnifiedClient(&fakeIndex{resp: response})
	result, err := backend.Search(t.Context(), &Query{
		Resource: alertrule.ResourceInfo.GroupResource(), Fields: []string{fieldTitle, fieldPanelID, fieldPaused, fieldLabels},
	})
	require.NoError(t, err)
	require.Equal(t, []Hit{{Name: "a", Values: map[string]any{
		fieldTitle: "title", fieldPanelID: int64(9007199254740993), fieldPaused: false, fieldLabels: []string{},
	}}}, result.Hits)
	require.Equal(t, int64(5), result.TotalHits)
	require.True(t, result.TotalHitsExact)
}

func TestUnifiedBackendEmptyResponses(t *testing.T) {
	for _, response := range []*resourcepb.ResourceSearchResponse{
		nil,
		{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES},
		{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES, TotalHits: 10},
	} {
		result, err := NewUnifiedClient(&fakeIndex{resp: response}).Search(t.Context(), &Query{})
		require.NoError(t, err)
		require.Empty(t, result.Hits)
		require.Equal(t, response.GetTotalHits(), result.TotalHits)
	}
}
