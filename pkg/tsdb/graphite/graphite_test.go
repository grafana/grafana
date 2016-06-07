package graphite

// func TestGraphite(t *testing.T) {
//
// 	Convey("When executing graphite query", t, func() {
// 		executor := NewGraphiteExecutor(&tsdb.DataSourceInfo{
// 			Url: "http://localhost:8080",
// 		})
//
// 		queries := tsdb.QuerySlice{
// 			&tsdb.Query{Query: "{\"target\": \"apps.backend.*.counters.requests.count\"}"},
// 		}
//
// 		context := tsdb.NewQueryContext(queries, tsdb.TimeRange{})
// 		result := executor.Execute(queries, context)
// 		So(result.Error, ShouldBeNil)
//
// 		Convey("Should return series", func() {
// 			So(result.QueryResults, ShouldNotBeEmpty)
// 		})
// 	})
//
// }
