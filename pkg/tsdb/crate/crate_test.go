package crate

import (
	"database/sql"
	_ "encoding/json"
	_ "io/ioutil"
	_ "net/http"
	_ "net/url"
	_ "path"
	_ "strings"
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	_ "github.com/grafana/grafana/pkg/setting"
	_ "github.com/herenow/go-crate"
	_ "golang.org/x/net/context/ctxhttp"
)

func TestCrate(t *testing.T) {
	runCrateTests := false

	if !(runCrateTests) {
		t.Skip()
	}

	Convey("CrateDB", t, func() {
		db, err := sql.Open("crate", "http://test:test@localhost:4200")
		So(err, ShouldBeNil)

		Convey("Given a table with different data types", func() {
			queryString := `
				DROP TABLE IF EXISTS "test_types";
			`
			_, err := db.Query(queryString)
			So(err, ShouldBeNil)
			queryString = `
				CREATE TABLE test_types(
					"0_integer" integer,
					"1_long" long,
					"2_float" float,
					"3_double" double,
					"4_timestamp" timestamp
				);
			`
			_, err = db.Query(queryString)
			So(err, ShouldBeNil)
			queryString = `
				INSERT INTO test_types VALUES(
					1,2,1.1,1.2,1536154645000
				);
			`
			_, err = db.Query(queryString)
			So(err, ShouldBeNil)
			queryString = `
				INSERT INTO test_types VALUES
					(1,2,1.1,1.2,1536154645000);
			`
			_, err = db.Query(queryString)
			So(err, ShouldBeNil)
			Convey("Converts types", func() {
				queryString := `
					SELECT "4_timestamp","0_integer" FROM doc.test_types WHERE "4_timestamp">1536154644000 AND "4_timestamp"<1536154649000;
				`
				rows, err := db.Query(queryString)
				So(err, ShouldBeNil)
				for rows.Next() {
					var timeValue string
					var metricValue string
					err := rows.Scan(&timeValue, &metricValue)
					So(err, ShouldBeNil)
					_, err = parseDbValues(timeValue, metricValue)
					So(err, ShouldBeNil)
				}
			})
		})
	})
}
