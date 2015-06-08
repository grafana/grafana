///<amd-dependency path="../datasource" />
///<amd-dependency path="test/specs/helpers" name="helpers" />

import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';
import moment  = require('moment');

declare var helpers: any;

describe('GnocchiDatasource', function() {
  var ctx = new helpers.ServiceTestContext();

  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(ctx.createService('GnocchiDatasource'));
  beforeEach(function() {
    ctx.ds = new ctx.service({ url: [''], jsonData: {token: 'XXXXXXXXXXXXX'} });
  });

  function assert_simple_test(targets, method, url, data, label) {
    var query = {
      range: { from: moment([2014, 3, 10, 3, 20, 10]), to: moment([2014, 3, 20, 3, 20, 10]) },
      targets: targets,
      interval: '1s'
    };
    var headers = {"X-Auth-Token": "XXXXXXXXXXXXX", "Accept": "application/json, text/plain, */*"};
    if (data !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    var results;
    beforeEach(function() {
      ctx.$httpBackend.expect(method, url, data, headers).respond([
        ["2014-10-06T14:33:57", "60.0", "43.1"],
        ["2014-10-06T14:34:12", "60.0", "12"],
        ["2014-10-06T14:34:20", "60.0", "2"]
      ]);
      ctx.ds.query(query).then(function(data) { results = data; });
      ctx.$httpBackend.flush();
    });

    it("nothing more", function() {
      ctx.$httpBackend.verifyNoOutstandingExpectation();
      ctx.$httpBackend.verifyNoOutstandingRequest();
    });

    it('should return series list', function() {
      expect(results.data.length).to.be(1);
      expect(results.data[0].target).to.be(label);
      expect(results.data[0].datapoints[0][0]).to.be('43.1');
      expect(results.data[0].datapoints[0][1]).to.be(1412606037000);
      expect(results.data[0].datapoints[1][0]).to.be('12');
      expect(results.data[0].datapoints[1][1]).to.be(1412606052000);
      expect(results.data[0].datapoints[2][0]).to.be('2');
      expect(results.data[0].datapoints[2][1]).to.be(1412606060000);
    });

  }

  describe('Resource', function() {
    beforeEach(function() {
      ctx.$httpBackend.expect("GET", "/v1/resource/instance/my_uuid").respond({
        "display_name": "myfirstvm",
        "id": "6868da77-fa82-4e67-aba9-270c5ae8cbca",
      });
    });

    assert_simple_test(
      [{ queryMode: 'resource', resource_type:   'instance', resource_id: 'my_uuid', metric_name: 'cpu_util', aggregator: 'max' }],
      'GET',
      "/v1/resource/instance/my_uuid/metric/cpu_util/measures?" +
        "aggregation=max&end=2014-04-20T03:20:10.000Z&start=2014-04-10T03:20:10.000Z",
      undefined,
      'my_uuid'
      );
  });

  describe('Metric', function() {
    assert_simple_test(
      [{ queryMode: 'metric', metric_id: 'my_uuid', aggregator: 'max' }],
      'GET',
      '/v1/metric/my_uuid/measures?aggregation=max&end=2014-04-20T03:20:10.000Z&start=2014-04-10T03:20:10.000Z',
      undefined,
      'my_uuid'
      );
  });

  describe('Resource aggregation', function() {
    assert_simple_test(
      [{ queryMode: 'resource_aggregation', resource_search: '{"=": {"server_group": "autoscalig_group"}}',
        resource_type: 'instance', label: 'my_aggregation', metric_name: 'cpu_util', aggregator: 'max' }],
      'POST',
      "/v1/aggregation/resource/instance/metric/cpu_util?" +
        "aggregation=max&end=2014-04-20T03:20:10.000Z&start=2014-04-10T03:20:10.000Z",
      {"=": {"server_group": "autoscalig_group"}},
      'my_aggregation');
  });

  describe('Resource search', function() {
    var query = {
      range: { from: moment([2014, 3, 10, 3, 20, 10]), to: moment([2014, 3, 20, 3, 20, 10]) },
      targets: [{ queryMode: 'resource_search', resource_search: '{"=": {"server_group": "autoscalig_group"}}',
        resource_type: 'instance', label: 'display_name', metric_name: 'cpu_util', aggregator: 'max' }],
      interval: '1s'
    };

    var url_expected_search_resources = "/v1/search/resource/instance";
    var response_search_resources = [
      {
        "display_name": "myfirstvm",
        "host": "compute1",
        "id": "6868da77-fa82-4e67-aba9-270c5ae8cbca",
        "image_ref": "http://image",
        "type": "instance",
        "server_group": "autoscalig_group",
      },
      {
        "display_name": "mysecondvm",
        "host": "compute1",
        "id": "f898ba55-bbea-460f-985c-3d1243348304",
        "image_ref": "http://image",
        "type": "instance",
        "server_group": "autoscalig_group",
      }
    ];

    var url_expected_get_measures1 = "/v1/resource/instance/6868da77-fa82-4e67-aba9-270c5ae8cbca/metric/cpu_util/measures?" +
      "aggregation=max&end=2014-04-20T03:20:10.000Z&start=2014-04-10T03:20:10.000Z";
    var response_get_measures1 = [
      ["2014-10-06T14:33:57", "60.0", "43.1"],
      ["2014-10-06T14:34:12", "60.0", "12"],
      ["2014-10-06T14:34:20", "60.0", "2"],
    ];

    var url_expected_get_measures2 = "/v1/resource/instance/f898ba55-bbea-460f-985c-3d1243348304/metric/cpu_util/measures?" +
      "aggregation=max&end=2014-04-20T03:20:10.000Z&start=2014-04-10T03:20:10.000Z";
    var response_get_measures2 = [
      ["2014-10-06T14:33:57", "60.0", "22.1"],
      ["2014-10-06T14:34:12", "60.0", "3"],
      ["2014-10-06T14:34:20", "60.0", "30"],
    ];

    var results;
    beforeEach(function() {
      ctx.$httpBackend.expect('POST', url_expected_search_resources).respond(response_search_resources);
      ctx.$httpBackend.expect('GET', url_expected_get_measures1).respond(response_get_measures1);
      ctx.$httpBackend.expect('GET', url_expected_get_measures2).respond(response_get_measures2);
      ctx.ds.query(query).then(function(data) { results = data; });
      ctx.$httpBackend.flush();
    });

    it("nothing more", function() {
      ctx.$httpBackend.verifyNoOutstandingExpectation();
      ctx.$httpBackend.verifyNoOutstandingRequest();
    });

    it('should return series list', function() {
      expect(results.data.length).to.be(2);
      expect(results.data[0].target).to.be('myfirstvm');
      expect(results.data[1].target).to.be('mysecondvm');
      expect(results.data[0].datapoints[0][0]).to.be('43.1');
      expect(results.data[0].datapoints[0][1]).to.be(1412606037000);
      expect(results.data[0].datapoints[1][0]).to.be('12');
      expect(results.data[0].datapoints[1][1]).to.be(1412606052000);
      expect(results.data[0].datapoints[2][0]).to.be('2');
      expect(results.data[0].datapoints[2][1]).to.be(1412606060000);
    });
  });

  describe("TestDatasource success", function() {
    var results;
    beforeEach(function() {
      ctx.$httpBackend.expect('GET', "").respond(200);
      ctx.ds.testDatasource().then(function(data) { results = data; });
      ctx.$httpBackend.flush();
    });

    it("nothing more", function() {
      ctx.$httpBackend.verifyNoOutstandingExpectation();
      ctx.$httpBackend.verifyNoOutstandingRequest();
    });

    it('should success', function() {
      expect(results.status).to.be('success');
      expect(results.message).to.be('Data source is working');
    });
  });

  describe("TestDatasource keystone success", function() {
    var results;
    beforeEach(function() {
      ctx.ds = new ctx.service({
        'url': 'http://localhost:5000',
        'jsonData': {'username': 'user', 'project': 'proj', 'password': 'pass'}
      });

      ctx.$httpBackend.expect(
        'POST', "http://localhost:5000/v3/auth/tokens",
        {"auth": { "identity": { "methods": ["password"],
          "password": { "user": { "name": "user", "password": "pass", "domain": { "id": "default"}}}},
          "scope": { "project": { "domain": { "id": "default" }, "name": "proj"}}}},
          {'Content-Type': 'application/json', "Accept": "application/json, text/plain, */*"}
      ).respond({'token': {'catalog': [{'type': 'metric', 'endpoints':
        [{'url': 'http://localhost:8041/', 'interface': 'public'}]}]}}, {'X-Subject-Token': 'foobar'});
      ctx.$httpBackend.expect('GET', "http://localhost:8041/", undefined,
                             {"Accept": "application/json, text/plain, */*",
                              "X-Auth-Token": "foobar"}).respond(200);

      ctx.ds.testDatasource().then(function(data) { results = data; });
      ctx.$httpBackend.flush();
    });

    it("nothing more", function() {
      ctx.$httpBackend.verifyNoOutstandingExpectation();
      ctx.$httpBackend.verifyNoOutstandingRequest();
    });

    it('should success', function() {
      expect(results.status).to.be('success');
      expect(results.message).to.be('Data source is working');
    });
  });

  describe("metricFindQuery resource", function() {
    var url_expected_search_resources = "/v1/search/resource/instance";
    var response_search_resources = [
      {
        "display_name": "myfirstvm",
        "host": "compute1",
        "id": "6868da77-fa82-4e67-aba9-270c5ae8cbca",
        "image_ref": "http://image",
        "type": "instance",
        "server_group": "autoscalig_group",
      },
      {
        "display_name": "mysecondvm",
        "host": "compute1",
        "id": "f898ba55-bbea-460f-985c-3d1243348304",
        "image_ref": "http://image",
        "type": "instance",
        "server_group": "autoscalig_group",
      }
    ];

    var results;
    beforeEach(function() {
      ctx.$httpBackend.expect('POST', url_expected_search_resources).respond(response_search_resources);
      ctx.ds.metricFindQuery('resources(instance, id, {"=": {"id": "foobar"}})').then(function(data) { results = data; });
      ctx.$httpBackend.flush();
    });

    it("nothing more", function() {
      ctx.$httpBackend.verifyNoOutstandingExpectation();
      ctx.$httpBackend.verifyNoOutstandingRequest();
    });

    it('should success', function() {
      expect(results.length).to.be(2);
      expect(results[0].text).to.be("6868da77-fa82-4e67-aba9-270c5ae8cbca");
      expect(results[1].text).to.be("f898ba55-bbea-460f-985c-3d1243348304");
    });
  });

  describe("metricFindQuery metric", function() {
    var url_expected = "/v1/resource/generic/6868da77-fa82-4e67-aba9-270c5ae8cbca";
    var response_resource = {
      "created_by_project_id": "8a722a26-e0a0-4993-b283-76925b7b02de",
      "created_by_user_id": "5587ebf3-58a5-42eb-8024-ef756e09a552",
      "ended_at": null,
      "id": "cba8d3d5-d5e1-4692-bcfe-d77feaf01d7e",
      "metrics": {
        "temperature": "86adbe6c-22d7-4a86-9ab7-e8d112f6cb79",
        "cpu_util": "ccdd3d2c-7f83-42a0-9280-49e0791349dd"
      },
      "project_id": "bd3a1e52-1c62-44cb-bf04-660bd88cd74d",
      "revision_end": null,
      "revision_start": "2015-09-10T08:00:25.690667+00:00",
      "started_at": "2015-09-10T08:00:25.690654+00:00",
      "type": "generic",
      "user_id": "bd3a1e52-1c62-44cb-bf04-660bd88cd74d"
    };

    var results;
    beforeEach(function() {
      ctx.$httpBackend.expect('GET', url_expected).respond(response_resource);
      ctx.ds.metricFindQuery('metrics(6868da77-fa82-4e67-aba9-270c5ae8cbca)').then(function(data) { results = data; });
      ctx.$httpBackend.flush();
    });

    it("nothing more", function() {
      ctx.$httpBackend.verifyNoOutstandingExpectation();
      ctx.$httpBackend.verifyNoOutstandingRequest();
    });

    it('should success', function() {
      expect(results.length).to.be(2);
      expect(results[0].text).to.be("temperature");
      expect(results[1].text).to.be("cpu_util");
    });
  });

  describe("metricFindQuery unknown", function() {
    var results;
    beforeEach(function() {
      ctx.ds.metricFindQuery('not_existing(instance, id, {"=": {"id": "foobar"}})').then(function(data) { results = data; });
    });

    it("nothing more", function() {
      ctx.$httpBackend.verifyNoOutstandingExpectation();
      ctx.$httpBackend.verifyNoOutstandingRequest();
    });

    it('should success', function() {
      expect(results.length).to.be(0);
    });
  });

});
;
