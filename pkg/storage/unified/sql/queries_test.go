package sql

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestQueries(t *testing.T) {
	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir: "testdata",
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlResourceDelete: {
				{
					Name: "simple",
					Data: &sqlResourceRequest{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
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
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
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
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
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
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
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
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
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
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
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

			sqlResourceUpdateRV: {
				{
					Name: "single path",
					Data: &sqlResourceUpdateRVRequest{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
					},
				},
			},

			sqlResourceHistoryRead: {
				{
					Name: "single path",
					Data: &sqlResourceReadRequest{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
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
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
					},
				},
			},

			sqlResourceHistoryInsert: {
				{
					Name: "insert into resource_history",
					Data: &sqlResourceRequest{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
						WriteEvent: resource.WriteEvent{
							Key: &resource.ResourceKey{},
						},
					},
				},
			},

			sqlResourceVersionGet: {
				{
					Name: "single path",
					Data: &sqlResourceVersionRequest{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
						resourceVersion:  new(resourceVersion),
						ReadOnly:         false,
					},
				},
			},

			sqlResourceVersionInc: {
				{
					Name: "increment resource version",
					Data: &sqlResourceVersionRequest{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
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
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
					},
				},
			},
		}})
}
