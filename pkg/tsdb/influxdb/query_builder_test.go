package influxdb

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestInfluxdbQueryBuilder(t *testing.T) {
	Convey("Influxdb query builder", t, func() {

		builder := &QueryBuild{}

		Convey("can build query", func() {
			//query := &Query{}
			//res, err := builder.Build(query)
			//So(err, ShouldBeNil)
		})

		Convey("empty queries should return error", func() {
			query := &Query{}

			res, err := builder.Build(query)
			So(err, ShouldNotBeNil)
			So(res, ShouldEqual, "")
		})
	})
}

/*
  describe('render series with mesurement only', function() {
    it('should generate correct query', function() {
      var query = new InfluxQuery({
        measurement: 'cpu',
      }, templateSrv, {});

      var queryText = query.render();
      expect(queryText).to.be('SELECT mean("value") FROM "cpu" WHERE $timeFilter GROUP BY time($interval) fill(null)');
    });
  });
*/

/*
  describe('series with tags OR condition', function() {
    it('should generate correct query', function() {
      var query = new InfluxQuery({
        measurement: 'cpu',
        groupBy: [{type: 'time', params: ['auto']}],
        tags: [{key: 'hostname', value: 'server1'}, {key: 'hostname', value: 'server2', condition: "OR"}]
      }, templateSrv, {});

      var queryText = query.render();
      expect(queryText).to.be('SELECT mean("value") FROM "cpu" WHERE "hostname" = \'server1\' OR "hostname" = \'server2\' AND ' +
                          '$timeFilter GROUP BY time($interval)');
    });
  });
*/
