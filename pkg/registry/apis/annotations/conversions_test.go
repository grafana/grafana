package annotations

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/apps/annotations/pkg/apis/annotations/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/annotations"
)

func TestConvertToLegacyItem(t *testing.T) {
	userOrg25 := &identity.StaticRequester{OrgID: 25, UserID: 7, Login: "bob"}
	tests := []struct {
		name   string
		user   identity.Requester
		input  *v0alpha1.Annotation
		expect *annotations.Item
		err    string
	}{
		{
			name:  "missing user",
			input: &v0alpha1.Annotation{},
			err:   "a Requester was not found in the context",
		},
		{
			name:  "missing user",
			user:  &identity.StaticRequester{OrgID: 25, Login: "bob"},
			input: &v0alpha1.Annotation{},
			err:   "user has no internal id",
		},
		{
			name: "simple",
			user: userOrg25,
			input: &v0alpha1.Annotation{
				Spec: v0alpha1.AnnotationSpec{
					Text:    "hello world",
					Tags:    []string{"tag1", "tag2"},
					Time:    1234,
					TimeEnd: ptr.To(int64(5678)),
					Dashboard: &v0alpha1.AnnotationDashboard{
						Name:  "dash",
						Panel: ptr.To[int64](3),
					},
					Alert: &v0alpha1.AnnotationAlert{
						Name:      "alert-uid",
						NewState:  "alerting",
						PrevState: "ok",
						Id:        ptr.To[int64](55),
						Data: map[string]any{
							"hello": "world",
						},
					},
				},
			},
			expect: &annotations.Item{
				OrgID:        25,
				UserID:       7,
				Text:         "hello world",
				Tags:         []string{"tag1", "tag2"},
				DashboardUID: "dash",
				Epoch:        1234,
				EpochEnd:     5678,
				PanelID:      3,
				PrevState:    "ok",
				NewState:     "alerting",
				AlertID:      55,
				Data: simplejson.NewFromAny(map[string]any{
					"hello": "world",
				}),
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			if tt.user != nil {
				ctx = identity.WithRequester(ctx, tt.user)
			}
			query, err := toLegacyItem(ctx, tt.input)
			if tt.err != "" {
				require.Error(t, err)
				require.ErrorContains(t, err, tt.err)
				require.Nil(t, query)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.expect, query)
		})
	}
}

func TestToLegacyItemQuery(t *testing.T) {
	userOrg25 := &identity.StaticRequester{OrgID: 25}
	tests := []struct {
		name   string
		user   identity.Requester
		query  *v0alpha1.ItemQuery
		expect *annotations.ItemQuery
		err    string
	}{
		{
			name:  "missing user",
			query: &v0alpha1.ItemQuery{},
			err:   "a Requester was not found in the context",
		},
		{
			name: "simple",
			user: userOrg25,
			query: &v0alpha1.ItemQuery{
				From:         1234,
				To:           5678,
				DashboardUID: "aaa",
			},
			expect: &annotations.ItemQuery{
				OrgID:        25,
				From:         1234,
				To:           5678,
				DashboardUID: "aaa",
				SignedInUser: userOrg25,
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			if tt.user != nil {
				ctx = identity.WithRequester(ctx, tt.user)
			}
			query, err := toLegacyItemQuery(ctx, tt.query)
			if tt.err != "" {
				require.Error(t, err)
				require.ErrorContains(t, err, tt.err)
				require.Nil(t, query)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.expect, query)
		})
	}
}

func TestToAnnotations(t *testing.T) {
	tests := []struct {
		name   string
		input  []*annotations.ItemDTO
		expect *v0alpha1.AnnotationList
		err    string
	}{
		{
			name: "convert",
			input: []*annotations.ItemDTO{
				{
					ID:           10,
					DashboardUID: ptr.To("dash-uid"),
					PanelID:      3,
					Text:         "hello",
					Time:         1234,
					TimeEnd:      5678,
					Tags:         []string{"tag1", "tag2"},
					Created:      1735682461000,
					Updated:      1738360861000,
					AlertID:      55,
					Data: simplejson.NewFromAny(map[string]any{
						"hello": "world",
					}),
				},
				{
					ID:        11,
					Text:      "empty data",
					AlertID:   66,
					NewState:  "alerting",
					PrevState: "ok",
					Data:      simplejson.NewFromAny(map[string]any{}),
				},
			},
			expect: &v0alpha1.AnnotationList{
				Items: []v0alpha1.Annotation{
					{
						ObjectMeta: v1.ObjectMeta{
							Name:              "a10",
							CreationTimestamp: v1.NewTime(time.UnixMilli(1735682461000)),
							Annotations: map[string]string{
								"grafana.app/updatedTimestamp": "2025-01-31T22:01:01Z",
							},
							Labels: map[string]string{
								"grafana.app/deprecatedInternalID": "10",
							},
						},
						Spec: v0alpha1.AnnotationSpec{
							Text:    "hello",
							Time:    1234,
							TimeEnd: ptr.To(int64(5678)),
							Tags:    []string{"tag1", "tag2"},
							Dashboard: &v0alpha1.AnnotationDashboard{
								Name:  "dash-uid",
								Panel: ptr.To[int64](3),
							},
							Alert: &v0alpha1.AnnotationAlert{
								Id: ptr.To[int64](55),
								Data: map[string]any{
									"hello": "world",
								},
							},
						},
					},
					{
						ObjectMeta: v1.ObjectMeta{
							Name: "a11",
							Labels: map[string]string{
								"grafana.app/deprecatedInternalID": "11",
							},
						},
						Spec: v0alpha1.AnnotationSpec{
							Text: "empty data",
							Alert: &v0alpha1.AnnotationAlert{
								Id:        ptr.To[int64](66),
								NewState:  "alerting",
								PrevState: "ok",
							},
						},
					},
				},
			},
		},
		{
			name: "invalid data",
			input: []*annotations.ItemDTO{
				{
					ID:   10,
					Data: simplejson.NewFromAny(10),
				},
			},
			err: "failed to convert annotation data",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := toAnnotationList(tt.input)
			if tt.err != "" {
				require.Error(t, err)
				require.ErrorContains(t, err, tt.err)
				require.Nil(t, result)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.expect, result)

			df, err := toDataFrame(result)
			require.NoError(t, err)

			experimental.CheckGoldenJSONFrame(t, "testdata", tt.name, df, true)
		})
	}
}
