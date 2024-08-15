package sql

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

func TestQueries(t *testing.T) {
	sqltemplate.CheckQuerySnapshots(t, sqltemplate.TemplateTestSetup{
		RootDir: "testdata",
		Templates: map[*template.Template][]sqltemplate.TemplateTestCase{
			sqlResourceDelete: {
				{
					Name: "simple",
					Data: &sqlResourceRequest{
						SQLTemplate: new(sqltemplate.SQLTemplate),
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
						SQLTemplate: new(sqltemplate.SQLTemplate),
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
						SQLTemplate: new(sqltemplate.SQLTemplate),
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
						SQLTemplate: new(sqltemplate.SQLTemplate),
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
						SQLTemplate: new(sqltemplate.SQLTemplate),
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
						SQLTemplate: new(sqltemplate.SQLTemplate),
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
						SQLTemplate: new(sqltemplate.SQLTemplate),
					},
				},
			},

			sqlResourceHistoryRead: {
				{
					Name: "single path",
					Data: &sqlResourceReadRequest{
						SQLTemplate: new(sqltemplate.SQLTemplate),
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
						SQLTemplate: new(sqltemplate.SQLTemplate),
					},
				},
			},

			sqlResourceHistoryInsert: {
				{
					Name: "insert into resource_history",
					Data: &sqlResourceRequest{
						SQLTemplate: new(sqltemplate.SQLTemplate),
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
						SQLTemplate:     new(sqltemplate.SQLTemplate),
						resourceVersion: new(resourceVersion),
						ReadOnly:        false,
					},
				},
			},

			sqlResourceVersionInc: {
				{
					Name: "increment resource version",
					Data: &sqlResourceVersionRequest{
						SQLTemplate: new(sqltemplate.SQLTemplate),
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
						SQLTemplate: new(sqltemplate.SQLTemplate),
					},
				},
			},
		}})
}
