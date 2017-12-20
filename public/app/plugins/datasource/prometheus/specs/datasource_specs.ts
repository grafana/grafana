import {
  describe,
  beforeEach,
  it,
  expect,
  angularMocks
} from "test/lib/common";
import moment from "moment";
import helpers from "test/specs/helpers";
import { PrometheusDatasource } from "../datasource";

describe("PrometheusDatasource", function() {
  var ctx = new helpers.ServiceTestContext();
  var instanceSettings = {
    url: "proxied",
    directUrl: "direct",
    user: "test",
    password: "mupp",
    jsonData: {}
  };

  beforeEach(angularMocks.module("grafana.core"));
  beforeEach(angularMocks.module("grafana.services"));
  beforeEach(ctx.providePhase(["timeSrv"]));

  beforeEach(
    angularMocks.inject(function($q, $rootScope, $httpBackend, $injector) {
      ctx.$q = $q;
      ctx.$httpBackend = $httpBackend;
      ctx.$rootScope = $rootScope;
      ctx.ds = $injector.instantiate(PrometheusDatasource, {
        instanceSettings: instanceSettings
      });
      $httpBackend.when("GET", /\.html$/).respond("");
    })
  );

  describe("When querying prometheus with one target using query editor target spec", function() {
    var results;
    var urlExpected =
      "proxied/api/v1/query_range?query=" +
      encodeURIComponent('test{job="testjob"}') +
      "&start=1443438675&end=1443460275&step=60";
    var query = {
      range: { from: moment(1443438674760), to: moment(1443460274760) },
      targets: [{ expr: 'test{job="testjob"}', format: "time_series" }],
      interval: "60s"
    };
    var response = {
      status: "success",
      data: {
        resultType: "matrix",
        result: [
          {
            metric: { __name__: "test", job: "testjob" },
            values: [[1443454528, "3846"]]
          }
        ]
      }
    };
    beforeEach(function() {
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.query(query).then(function(data) {
        results = data;
      });
      ctx.$httpBackend.flush();
    });
    it("should generate the correct query", function() {
      ctx.$httpBackend.verifyNoOutstandingExpectation();
    });
    it("should return series list", function() {
      expect(results.data.length).to.be(1);
      expect(results.data[0].target).to.be('test{job="testjob"}');
    });
  });
  describe("When querying prometheus with one target which return multiple series", function() {
    var results;
    var start = 1443438675;
    var end = 1443460275;
    var step = 60;
    var urlExpected =
      "proxied/api/v1/query_range?query=" +
      encodeURIComponent('test{job="testjob"}') +
      "&start=" +
      start +
      "&end=" +
      end +
      "&step=" +
      step;
    var query = {
      range: { from: moment(1443438674760), to: moment(1443460274760) },
      targets: [{ expr: 'test{job="testjob"}', format: "time_series" }],
      interval: "60s"
    };
    var response = {
      status: "success",
      data: {
        resultType: "matrix",
        result: [
          {
            metric: { __name__: "test", job: "testjob", series: "series 1" },
            values: [
              [start + step * 1, "3846"],
              [start + step * 3, "3847"],
              [end - step * 1, "3848"]
            ]
          },
          {
            metric: { __name__: "test", job: "testjob", series: "series 2" },
            values: [[start + step * 2, "4846"]]
          }
        ]
      }
    };
    beforeEach(function() {
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.query(query).then(function(data) {
        results = data;
      });
      ctx.$httpBackend.flush();
    });
    it("should be same length", function() {
      expect(results.data.length).to.be(2);
      expect(results.data[0].datapoints.length).to.be((end - start) / step + 1);
      expect(results.data[1].datapoints.length).to.be((end - start) / step + 1);
    });
    it("should fill null until first datapoint in response", function() {
      expect(results.data[0].datapoints[0][1]).to.be(start * 1000);
      expect(results.data[0].datapoints[0][0]).to.be(null);
      expect(results.data[0].datapoints[1][1]).to.be((start + step * 1) * 1000);
      expect(results.data[0].datapoints[1][0]).to.be(3846);
    });
    it("should fill null after last datapoint in response", function() {
      var length = (end - start) / step + 1;
      expect(results.data[0].datapoints[length - 2][1]).to.be(
        (end - step * 1) * 1000
      );
      expect(results.data[0].datapoints[length - 2][0]).to.be(3848);
      expect(results.data[0].datapoints[length - 1][1]).to.be(end * 1000);
      expect(results.data[0].datapoints[length - 1][0]).to.be(null);
    });
    it("should fill null at gap between series", function() {
      expect(results.data[0].datapoints[2][1]).to.be((start + step * 2) * 1000);
      expect(results.data[0].datapoints[2][0]).to.be(null);
      expect(results.data[1].datapoints[1][1]).to.be((start + step * 1) * 1000);
      expect(results.data[1].datapoints[1][0]).to.be(null);
      expect(results.data[1].datapoints[3][1]).to.be((start + step * 3) * 1000);
      expect(results.data[1].datapoints[3][0]).to.be(null);
    });
  });
  describe("When querying prometheus with one target and instant = true", function() {
    var results;
    var urlExpected =
      "proxied/api/v1/query?query=" +
      encodeURIComponent('test{job="testjob"}') +
      "&time=1443460275";
    var query = {
      range: { from: moment(1443438674760), to: moment(1443460274760) },
      targets: [
        { expr: 'test{job="testjob"}', format: "time_series", instant: true }
      ],
      interval: "60s"
    };
    var response = {
      status: "success",
      data: {
        resultType: "vector",
        result: [
          {
            metric: { __name__: "test", job: "testjob" },
            value: [1443454528, "3846"]
          }
        ]
      }
    };
    beforeEach(function() {
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.query(query).then(function(data) {
        results = data;
      });
      ctx.$httpBackend.flush();
    });
    it("should generate the correct query", function() {
      ctx.$httpBackend.verifyNoOutstandingExpectation();
    });
    it("should return series list", function() {
      expect(results.data.length).to.be(1);
      expect(results.data[0].target).to.be('test{job="testjob"}');
    });
  });
  describe("When performing annotationQuery", function() {
    var results;
    var urlExpected =
      "proxied/api/v1/query_range?query=" +
      encodeURIComponent('ALERTS{alertstate="firing"}') +
      "&start=1443438675&end=1443460275&step=60s";
    var options = {
      annotation: {
        expr: 'ALERTS{alertstate="firing"}',
        tagKeys: "job",
        titleFormat: "{{alertname}}",
        textFormat: "{{instance}}"
      },
      range: {
        from: moment(1443438674760),
        to: moment(1443460274760)
      }
    };
    var response = {
      status: "success",
      data: {
        resultType: "matrix",
        result: [
          {
            metric: {
              __name__: "ALERTS",
              alertname: "InstanceDown",
              alertstate: "firing",
              instance: "testinstance",
              job: "testjob"
            },
            values: [[1443454528, "1"]]
          }
        ]
      }
    };
    beforeEach(function() {
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.annotationQuery(options).then(function(data) {
        results = data;
      });
      ctx.$httpBackend.flush();
    });
    it("should return annotation list", function() {
      ctx.$rootScope.$apply();
      expect(results.length).to.be(1);
      expect(results[0].tags).to.contain("testjob");
      expect(results[0].title).to.be("InstanceDown");
      expect(results[0].text).to.be("testinstance");
      expect(results[0].time).to.be(1443454528 * 1000);
    });
  });
  describe("When resultFormat is table", function() {
    var response = {
      status: "success",
      data: {
        resultType: "matrix",
        result: [
          {
            metric: { __name__: "test", job: "testjob" },
            values: [[1443454528, "3846"]]
          },
          {
            metric: {
              __name__: "test",
              instance: "localhost:8080",
              job: "otherjob"
            },
            values: [[1443454529, "3847"]]
          }
        ]
      }
    };
    it("should return table model", function() {
      var table = ctx.ds.transformMetricDataToTable(response.data.result);
      expect(table.type).to.be("table");
      expect(table.rows).to.eql([
        [1443454528000, "test", "", "testjob", 3846],
        [1443454529000, "test", "localhost:8080", "otherjob", 3847]
      ]);
      expect(table.columns).to.eql([
        { text: "Time", type: "time" },
        { text: "__name__" },
        { text: "instance" },
        { text: "job" },
        { text: "Value" }
      ]);
    });
  });

  describe("When resultFormat is table and instant = true", function() {
    var results;
    var urlExpected =
      "proxied/api/v1/query?query=" +
      encodeURIComponent('test{job="testjob"}') +
      "&time=1443460275";
    var query = {
      range: { from: moment(1443438674760), to: moment(1443460274760) },
      targets: [
        { expr: 'test{job="testjob"}', format: "time_series", instant: true }
      ],
      interval: "60s"
    };
    var response = {
      status: "success",
      data: {
        resultType: "vector",
        result: [
          {
            metric: { __name__: "test", job: "testjob" },
            value: [1443454528, "3846"]
          }
        ]
      }
    };

    beforeEach(function() {
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.query(query).then(function(data) {
        results = data;
      });
      ctx.$httpBackend.flush();
    });

    it("should return result", () => {
      expect(results).not.to.be(null);
    });

    it("should return table model", function() {
      var table = ctx.ds.transformMetricDataToTable(response.data.result);
      expect(table.type).to.be("table");
      expect(table.rows).to.eql([[1443454528000, "test", "testjob", 3846]]);
      expect(table.columns).to.eql([
        { text: "Time", type: "time" },
        { text: "__name__" },
        { text: "job" },
        { text: "Value" }
      ]);
    });
  });
  describe('The "step" query parameter', function() {
    var response = {
      status: "success",
      data: {
        resultType: "matrix",
        result: []
      }
    };

    it("should be min interval when greater than auto interval", function() {
      var query = {
        // 6 hour range
        range: { from: moment(1443438674760), to: moment(1443460274760) },
        targets: [
          {
            expr: "test",
            interval: "10s"
          }
        ],
        interval: "5s"
      };
      var urlExpected =
        "proxied/api/v1/query_range?query=test" +
        "&start=1443438675&end=1443460275&step=10";
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.query(query);
      ctx.$httpBackend.verifyNoOutstandingExpectation();
    });

    it("step should never go below 1", function() {
      var query = {
        // 6 hour range
        range: { from: moment(1508318768202), to: moment(1508318770118) },
        targets: [{ expr: "test" }],
        interval: "100ms"
      };
      var urlExpected =
        "proxied/api/v1/query_range?query=test&start=1508318769&end=1508318771&step=1";
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.query(query);
      ctx.$httpBackend.verifyNoOutstandingExpectation();
    });

    it("should be auto interval when greater than min interval", function() {
      var query = {
        // 6 hour range
        range: { from: moment(1443438674760), to: moment(1443460274760) },
        targets: [
          {
            expr: "test",
            interval: "5s"
          }
        ],
        interval: "10s"
      };
      var urlExpected =
        "proxied/api/v1/query_range?query=test" +
        "&start=1443438675&end=1443460275&step=10";
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.query(query);
      ctx.$httpBackend.verifyNoOutstandingExpectation();
    });
    it("should result in querying fewer than 11000 data points", function() {
      var query = {
        // 6 hour range
        range: { from: moment(1443438674760), to: moment(1443460274760) },
        targets: [{ expr: "test" }],
        interval: "1s"
      };
      var urlExpected =
        "proxied/api/v1/query_range?query=test" +
        "&start=1443438675&end=1443460275&step=2";
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.query(query);
      ctx.$httpBackend.verifyNoOutstandingExpectation();
    });
    it("should not apply min interval when interval * intervalFactor greater", function() {
      var query = {
        // 6 hour range
        range: { from: moment(1443438674760), to: moment(1443460274760) },
        targets: [
          {
            expr: "test",
            interval: "10s",
            intervalFactor: 10
          }
        ],
        interval: "5s"
      };
      var urlExpected =
        "proxied/api/v1/query_range?query=test" +
        "&start=1443438675&end=1443460275&step=50";
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.query(query);
      ctx.$httpBackend.verifyNoOutstandingExpectation();
    });
    it("should apply min interval when interval * intervalFactor smaller", function() {
      var query = {
        // 6 hour range
        range: { from: moment(1443438674760), to: moment(1443460274760) },
        targets: [
          {
            expr: "test",
            interval: "15s",
            intervalFactor: 2
          }
        ],
        interval: "5s"
      };
      var urlExpected =
        "proxied/api/v1/query_range?query=test" +
        "&start=1443438675&end=1443460275&step=15";
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.query(query);
      ctx.$httpBackend.verifyNoOutstandingExpectation();
    });
    it("should apply intervalFactor to auto interval when greater", function() {
      var query = {
        // 6 hour range
        range: { from: moment(1443438674760), to: moment(1443460274760) },
        targets: [
          {
            expr: "test",
            interval: "5s",
            intervalFactor: 10
          }
        ],
        interval: "10s"
      };
      var urlExpected =
        "proxied/api/v1/query_range?query=test" +
        "&start=1443438675&end=1443460275&step=100";
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.query(query);
      ctx.$httpBackend.verifyNoOutstandingExpectation();
    });
    it("should not not be affected by the 11000 data points limit when large enough", function() {
      var query = {
        // 1 week range
        range: { from: moment(1443438674760), to: moment(1444043474760) },
        targets: [
          {
            expr: "test",
            intervalFactor: 10
          }
        ],
        interval: "10s"
      };
      var urlExpected =
        "proxied/api/v1/query_range?query=test" +
        "&start=1443438675&end=1444043475&step=100";
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.query(query);
      ctx.$httpBackend.verifyNoOutstandingExpectation();
    });
    it("should be determined by the 11000 data points limit when too small", function() {
      var query = {
        // 1 week range
        range: { from: moment(1443438674760), to: moment(1444043474760) },
        targets: [
          {
            expr: "test",
            intervalFactor: 10
          }
        ],
        interval: "5s"
      };
      var urlExpected =
        "proxied/api/v1/query_range?query=test" +
        "&start=1443438675&end=1444043475&step=60";
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.query(query);
      ctx.$httpBackend.verifyNoOutstandingExpectation();
    });
  });
  describe("The __interval and __interval_ms template variables", function() {
    var response = {
      status: "success",
      data: {
        resultType: "matrix",
        result: []
      }
    };

    it("should be unchanged when auto interval is greater than min interval", function() {
      var query = {
        // 6 hour range
        range: { from: moment(1443438674760), to: moment(1443460274760) },
        targets: [
          {
            expr: "rate(test[$__interval])",
            interval: "5s"
          }
        ],
        interval: "10s",
        scopedVars: {
          __interval: { text: "10s", value: "10s" },
          __interval_ms: { text: 10 * 1000, value: 10 * 1000 }
        }
      };
      var urlExpected =
        "proxied/api/v1/query_range?query=" +
        encodeURIComponent("rate(test[10s])") +
        "&start=1443438675&end=1443460275&step=10";
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.query(query);
      ctx.$httpBackend.verifyNoOutstandingExpectation();

      expect(query.scopedVars.__interval.text).to.be("10s");
      expect(query.scopedVars.__interval.value).to.be("10s");
      expect(query.scopedVars.__interval_ms.text).to.be(10 * 1000);
      expect(query.scopedVars.__interval_ms.value).to.be(10 * 1000);
    });
    it("should be min interval when it is greater than auto interval", function() {
      var query = {
        // 6 hour range
        range: { from: moment(1443438674760), to: moment(1443460274760) },
        targets: [
          {
            expr: "rate(test[$__interval])",
            interval: "10s"
          }
        ],
        interval: "5s",
        scopedVars: {
          __interval: { text: "5s", value: "5s" },
          __interval_ms: { text: 5 * 1000, value: 5 * 1000 }
        }
      };
      var urlExpected =
        "proxied/api/v1/query_range?query=" +
        encodeURIComponent("rate(test[10s])") +
        "&start=1443438675&end=1443460275&step=10";
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.query(query);
      ctx.$httpBackend.verifyNoOutstandingExpectation();

      expect(query.scopedVars.__interval.text).to.be("5s");
      expect(query.scopedVars.__interval.value).to.be("5s");
      expect(query.scopedVars.__interval_ms.text).to.be(5 * 1000);
      expect(query.scopedVars.__interval_ms.value).to.be(5 * 1000);
    });
    it("should account for intervalFactor", function() {
      var query = {
        // 6 hour range
        range: { from: moment(1443438674760), to: moment(1443460274760) },
        targets: [
          {
            expr: "rate(test[$__interval])",
            interval: "5s",
            intervalFactor: 10
          }
        ],
        interval: "10s",
        scopedVars: {
          __interval: { text: "10s", value: "10s" },
          __interval_ms: { text: 10 * 1000, value: 10 * 1000 }
        }
      };
      var urlExpected =
        "proxied/api/v1/query_range?query=" +
        encodeURIComponent("rate(test[100s])") +
        "&start=1443438675&end=1443460275&step=100";
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.query(query);
      ctx.$httpBackend.verifyNoOutstandingExpectation();

      expect(query.scopedVars.__interval.text).to.be("10s");
      expect(query.scopedVars.__interval.value).to.be("10s");
      expect(query.scopedVars.__interval_ms.text).to.be(10 * 1000);
      expect(query.scopedVars.__interval_ms.value).to.be(10 * 1000);
    });
    it("should be interval * intervalFactor when greater than min interval", function() {
      var query = {
        // 6 hour range
        range: { from: moment(1443438674760), to: moment(1443460274760) },
        targets: [
          {
            expr: "rate(test[$__interval])",
            interval: "10s",
            intervalFactor: 10
          }
        ],
        interval: "5s",
        scopedVars: {
          __interval: { text: "5s", value: "5s" },
          __interval_ms: { text: 5 * 1000, value: 5 * 1000 }
        }
      };
      var urlExpected =
        "proxied/api/v1/query_range?query=" +
        encodeURIComponent("rate(test[50s])") +
        "&start=1443438675&end=1443460275&step=50";
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.query(query);
      ctx.$httpBackend.verifyNoOutstandingExpectation();

      expect(query.scopedVars.__interval.text).to.be("5s");
      expect(query.scopedVars.__interval.value).to.be("5s");
      expect(query.scopedVars.__interval_ms.text).to.be(5 * 1000);
      expect(query.scopedVars.__interval_ms.value).to.be(5 * 1000);
    });
    it("should be min interval when greater than interval * intervalFactor", function() {
      var query = {
        // 6 hour range
        range: { from: moment(1443438674760), to: moment(1443460274760) },
        targets: [
          {
            expr: "rate(test[$__interval])",
            interval: "15s",
            intervalFactor: 2
          }
        ],
        interval: "5s",
        scopedVars: {
          __interval: { text: "5s", value: "5s" },
          __interval_ms: { text: 5 * 1000, value: 5 * 1000 }
        }
      };
      var urlExpected =
        "proxied/api/v1/query_range?query=" +
        encodeURIComponent("rate(test[15s])") +
        "&start=1443438675&end=1443460275&step=15";
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.query(query);
      ctx.$httpBackend.verifyNoOutstandingExpectation();

      expect(query.scopedVars.__interval.text).to.be("5s");
      expect(query.scopedVars.__interval.value).to.be("5s");
      expect(query.scopedVars.__interval_ms.text).to.be(5 * 1000);
      expect(query.scopedVars.__interval_ms.value).to.be(5 * 1000);
    });
    it("should be determined by the 11000 data points limit, accounting for intervalFactor", function() {
      var query = {
        // 1 week range
        range: { from: moment(1443438674760), to: moment(1444043474760) },
        targets: [
          {
            expr: "rate(test[$__interval])",
            intervalFactor: 10
          }
        ],
        interval: "5s",
        scopedVars: {
          __interval: { text: "5s", value: "5s" },
          __interval_ms: { text: 5 * 1000, value: 5 * 1000 }
        }
      };
      var urlExpected =
        "proxied/api/v1/query_range?query=" +
        encodeURIComponent("rate(test[60s])") +
        "&start=1443438675&end=1444043475&step=60";
      ctx.$httpBackend.expect("GET", urlExpected).respond(response);
      ctx.ds.query(query);
      ctx.$httpBackend.verifyNoOutstandingExpectation();

      expect(query.scopedVars.__interval.text).to.be("5s");
      expect(query.scopedVars.__interval.value).to.be("5s");
      expect(query.scopedVars.__interval_ms.text).to.be(5 * 1000);
      expect(query.scopedVars.__interval_ms.value).to.be(5 * 1000);
    });
  });
});
