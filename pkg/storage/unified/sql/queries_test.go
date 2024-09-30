package sql

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestUnifiedStorageQueries(t *testing.T) {
	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir: "testdata",
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlResourceDelete: {
				{
					Name: "simple",
					Data: &sqlResourceRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						WriteEvent: resource.WriteEvent{
							Key: &resource.ResourceKey{
								Namespace: "nn",
								Group:     "gg",
								Resource:  "rr",
								Name:      "name",
							},
						},
					},
				},
			},
			sqlResourceInsert: {
				{
					Name: "simple",
					Data: &sqlResourceRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						WriteEvent: resource.WriteEvent{
							Key: &resource.ResourceKey{
								Namespace: "nn",
								Group:     "gg",
								Resource:  "rr",
								Name:      "name",
							},
							Type:       resource.WatchEvent_ADDED,
							PreviousRV: 123,
						},
					},
				},
			},
			sqlResourceUpdate: {
				{
					Name: "single path",
					Data: &sqlResourceRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						WriteEvent: resource.WriteEvent{
							Key: &resource.ResourceKey{},
						},
					},
				},
			},
			sqlResourceRead: {
				{
					Name: "without_resource_version",
					Data: &sqlResourceReadRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Request: &resource.ReadRequest{
							Key: &resource.ResourceKey{},
						},
						readResponse: new(readResponse),
					},
				},
			},

			sqlResourceList: {
				{
					Name: "filter_on_namespace",
					Data: &sqlResourceListRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Request: &resource.ListRequest{
							Limit: 10,
							Options: &resource.ListOptions{
								Key: &resource.ResourceKey{
									Namespace: "ns",
								},
							},
						},
					},
				},
			},

			sqlResourceHistoryList: {
				{
					Name: "single path",
					Data: &sqlResourceHistoryListRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Request: &historyListRequest{
							Limit: 10,
							Options: &resource.ListOptions{
								Key: &resource.ResourceKey{
									Namespace: "ns",
								},
							},
						},
						Response: new(resource.ResourceWrapper),
					},
				},
			},
			sqlResourceHistoryPoll: {
				{
					Name: "single path",
					Data: &sqlResourceHistoryPollRequest{
						SQLTemplate:          mocks.NewTestingSQLTemplate(),
						Resource:             "res",
						Group:                "group",
						SinceResourceVersion: 1234,
						Response:             new(historyPollResponse),
					},
				},
			},

			sqlResourceUpdateRV: {
				{
					Name: "single path",
					Data: &sqlResourceUpdateRVRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
					},
				},
			},

			sqlResourceHistoryRead: {
				{
					Name: "single path",
					Data: &sqlResourceReadRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Request: &resource.ReadRequest{
							ResourceVersion: 123,
							Key:             &resource.ResourceKey{},
						},
						readResponse: new(readResponse),
					},
				},
			},

			sqlResourceHistoryUpdateRV: {
				{
					Name: "single path",
					Data: &sqlResourceUpdateRVRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
					},
				},
			},

			sqlResourceHistoryInsert: {
				{
					Name: "insert into resource_history",
					Data: &sqlResourceRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						WriteEvent: resource.WriteEvent{
							Key:        &resource.ResourceKey{},
							PreviousRV: 1234,
						},
					},
				},
			},

			sqlResourceVersionGet: {
				{
					Name: "single path",
					Data: &sqlResourceVersionRequest{
						SQLTemplate:     mocks.NewTestingSQLTemplate(),
						resourceVersion: new(resourceVersion),
						ReadOnly:        false,
					},
				},
			},

			sqlResourceVersionInc: {
				{
					Name: "increment resource version",
					Data: &sqlResourceVersionRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						resourceVersion: &resourceVersion{
							ResourceVersion: 123,
						},
					},
				},
			},

			sqlResourceVersionInsert: {
				{
					Name: "single path",
					Data: &sqlResourceVersionRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
					},
				},
			},
		}})
}
