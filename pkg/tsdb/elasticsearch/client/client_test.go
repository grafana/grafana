package es

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"

	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestClient(t *testing.T) {
	Convey("Test elasticsearch client", t, func() {
		Convey("NewClient", func() {
			Convey("When no version set should return error", func() {
				ds := &models.DataSource{
					JsonData: simplejson.NewFromAny(make(map[string]interface{})),
				}

				_, err := NewClient(nil, ds, nil)
				So(err, ShouldNotBeNil)
			})

			Convey("When no time field name set should return error", func() {
				ds := &models.DataSource{
					JsonData: simplejson.NewFromAny(map[string]interface{}{
						"esVersion": 5,
					}),
				}

				_, err := NewClient(nil, ds, nil)
				So(err, ShouldNotBeNil)
			})

			Convey("When unspported version set should return error", func() {
				ds := &models.DataSource{
					JsonData: simplejson.NewFromAny(map[string]interface{}{
						"esVersion": 6,
						"timeField": "@timestamp",
					}),
				}

				_, err := NewClient(nil, ds, nil)
				So(err, ShouldNotBeNil)
			})

			Convey("When version 2 should return v2 client", func() {
				ds := &models.DataSource{
					JsonData: simplejson.NewFromAny(map[string]interface{}{
						"esVersion": 2,
						"timeField": "@timestamp",
					}),
				}

				c, err := NewClient(nil, ds, nil)
				So(err, ShouldBeNil)
				So(c.GetVersion(), ShouldEqual, 2)
			})

			Convey("When version 5 should return v5 client", func() {
				ds := &models.DataSource{
					JsonData: simplejson.NewFromAny(map[string]interface{}{
						"esVersion": 5,
						"timeField": "@timestamp",
					}),
				}

				c, err := NewClient(nil, ds, nil)
				So(err, ShouldBeNil)
				So(c.GetVersion(), ShouldEqual, 5)
			})

			Convey("When version 56 should return v5.6 client", func() {
				ds := &models.DataSource{
					JsonData: simplejson.NewFromAny(map[string]interface{}{
						"esVersion": 56,
						"timeField": "@timestamp",
					}),
				}

				c, err := NewClient(nil, ds, nil)
				So(err, ShouldBeNil)
				So(c.GetVersion(), ShouldEqual, 56)
			})
		})

		Convey("v2", func() {
			ds := &models.DataSource{
				JsonData: simplejson.NewFromAny(map[string]interface{}{
					"esVersion": 2,
				}),
			}

			c, err := newV2Client(newFakeBaseClient(ds, []string{"test-*"}))
			So(err, ShouldBeNil)
			So(c, ShouldNotBeNil)

			Convey("When creating multisearch requests should have correct headers", func() {
				multiRequests := c.createMultiSearchRequests([]*SearchRequest{
					{Index: "test-*"},
				})
				So(multiRequests, ShouldHaveLength, 1)
				header := multiRequests[0].header
				So(header, ShouldHaveLength, 3)
				So(header["index"], ShouldEqual, "test-*")
				So(header["ignore_unavailable"], ShouldEqual, true)
				So(header["search_type"], ShouldEqual, "count")
			})
		})

		Convey("v5", func() {
			ds := &models.DataSource{
				JsonData: simplejson.NewFromAny(map[string]interface{}{
					"esVersion": 5,
				}),
			}

			c, err := newV5Client(newFakeBaseClient(ds, []string{"test-*"}))
			So(err, ShouldBeNil)
			So(c, ShouldNotBeNil)

			Convey("When creating multisearch requests should have correct headers", func() {
				multiRequests := c.createMultiSearchRequests([]*SearchRequest{
					{Index: "test-*"},
				})
				So(multiRequests, ShouldHaveLength, 1)
				header := multiRequests[0].header
				So(header, ShouldHaveLength, 3)
				So(header["index"], ShouldEqual, "test-*")
				So(header["ignore_unavailable"], ShouldEqual, true)
				So(header["search_type"], ShouldEqual, "query_then_fetch")
			})
		})

		Convey("v5.6", func() {
			Convey("With default settings", func() {
				ds := models.DataSource{
					JsonData: simplejson.NewFromAny(map[string]interface{}{
						"esVersion": 56,
					}),
				}

				c, err := newV56Client(newFakeBaseClient(&ds, []string{"test-*"}))
				So(err, ShouldBeNil)
				So(c, ShouldNotBeNil)

				Convey("When creating multisearch requests should have correct headers", func() {
					multiRequests := c.createMultiSearchRequests([]*SearchRequest{
						{Index: "test-*"},
					})
					So(multiRequests, ShouldHaveLength, 1)
					header := multiRequests[0].header
					So(header, ShouldHaveLength, 4)
					So(header["index"], ShouldEqual, "test-*")
					So(header["ignore_unavailable"], ShouldEqual, true)
					So(header["search_type"], ShouldEqual, "query_then_fetch")
					So(header["max_concurrent_shard_requests"], ShouldEqual, 256)
				})
			})

			Convey("With custom settings", func() {
				ds := models.DataSource{
					JsonData: simplejson.NewFromAny(map[string]interface{}{
						"esVersion":                  56,
						"maxConcurrentShardRequests": 100,
					}),
				}

				c, err := newV56Client(newFakeBaseClient(&ds, []string{"test-*"}))
				So(err, ShouldBeNil)
				So(c, ShouldNotBeNil)
				Convey("When creating multisearch requests should have correct headers", func() {
					multiRequests := c.createMultiSearchRequests([]*SearchRequest{
						{Index: "test-*"},
					})
					So(multiRequests, ShouldHaveLength, 1)
					header := multiRequests[0].header
					So(header, ShouldHaveLength, 4)
					So(header["index"], ShouldEqual, "test-*")
					So(header["ignore_unavailable"], ShouldEqual, true)
					So(header["search_type"], ShouldEqual, "query_then_fetch")
					So(header["max_concurrent_shard_requests"], ShouldEqual, 100)
				})
			})
		})
	})
}

type fakeBaseClient struct {
	*baseClientImpl
	ds *models.DataSource
}

func newFakeBaseClient(ds *models.DataSource, indices []string) baseClient {
	return &fakeBaseClient{
		baseClientImpl: &baseClientImpl{
			ds:      ds,
			indices: indices,
		},
		ds: ds,
	}
}

func (c *fakeBaseClient) executeBatchRequest(uriPath string, requests []*multiRequest) (*http.Response, error) {
	return nil, nil
}

func (c *fakeBaseClient) executeRequest(method, uriPath string, body []byte) (*http.Response, error) {
	return nil, nil
}

func (c *fakeBaseClient) executeMultisearch(searchRequests []*SearchRequest) ([]*SearchResponse, error) {
	return nil, nil
}
