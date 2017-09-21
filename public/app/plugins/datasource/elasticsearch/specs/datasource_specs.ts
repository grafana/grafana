import _ from 'lodash';
import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';
import moment from 'moment';
import angular from 'angular';
import helpers from 'test/specs/helpers';
import {ElasticDatasource} from "../datasource";

describe('ElasticDatasource', function() {
  var ctx = new helpers.ServiceTestContext();
  var instanceSettings: any = {jsonData: {}};

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(ctx.providePhase(['templateSrv', 'backendSrv', 'timeSrv']));

  beforeEach(angularMocks.inject(function($q, $rootScope, $httpBackend, $injector) {
    ctx.$q = $q;
    ctx.$httpBackend =  $httpBackend;
    ctx.$rootScope = $rootScope;
    ctx.$injector = $injector;
    $httpBackend.when('GET', /\.html$/).respond('');
  }));

  function createDatasource(instanceSettings) {
    instanceSettings.jsonData = instanceSettings.jsonData || {};
    ctx.ds = ctx.$injector.instantiate(ElasticDatasource, {instanceSettings: instanceSettings});
  }

  describe('When testing datasource with index pattern', function() {
    beforeEach(function() {
      createDatasource({url: 'http://es.com', index: '[asd-]YYYY.MM.DD', jsonData: {interval: 'Daily', esVersion: '2'}});
    });

    it('should translate index pattern to current day', function() {
      var requestOptions;
      ctx.backendSrv.datasourceRequest = function(options) {
        requestOptions = options;
        return ctx.$q.when({data: {}});
      };

      ctx.ds.testDatasource();
      ctx.$rootScope.$apply();

      var today = moment.utc().format("YYYY.MM.DD");
      expect(requestOptions.url).to.be("http://es.com/asd-" + today + '/_mapping');
    });
  });

  describe('When issueing metric query with interval pattern', function() {
    var requestOptions, parts, header;

    beforeEach(function() {
      createDatasource({url: 'http://es.com', index: '[asd-]YYYY.MM.DD', jsonData: {interval: 'Daily', esVersion: '2'}});

      ctx.backendSrv.datasourceRequest = function(options) {
        requestOptions = options;
        return ctx.$q.when({data: {responses: []}});
      };

      ctx.ds.query({
        range: {
          from: moment.utc([2015, 4, 30, 10]),
          to: moment.utc([2015, 5, 1, 10])
        },
        targets: [{ bucketAggs: [], metrics: [{type: 'raw_document'}], query: 'escape\\:test' }]
      });

      ctx.$rootScope.$apply();

      parts = requestOptions.data.split('\n');
      header = angular.fromJson(parts[0]);
    });

    it('should translate index pattern to current day', function() {
      expect(header.index).to.eql(['asd-2015.05.30', 'asd-2015.05.31', 'asd-2015.06.01']);
    });

    it('should json escape lucene query', function() {
      var body = angular.fromJson(parts[1]);
      expect(body.query.bool.filter[1].query_string.query).to.be('escape\\:test');
    });
  });

  describe('When issueing document query', function() {
    var requestOptions, parts, header;

    beforeEach(function() {
      createDatasource({url: 'http://es.com', index: 'test', jsonData: {esVersion: '2'}});

      ctx.backendSrv.datasourceRequest = function(options) {
        requestOptions = options;
        return ctx.$q.when({data: {responses: []}});
      };

      ctx.ds.query({
        range: { from: moment([2015, 4, 30, 10]), to: moment([2015, 5, 1, 10]) },
        targets: [{ bucketAggs: [], metrics: [{type: 'raw_document'}], query: 'test' }]
      });

      ctx.$rootScope.$apply();
      parts = requestOptions.data.split('\n');
      header = angular.fromJson(parts[0]);
    });

    it('should set search type to query_then_fetch', function() {
      expect(header.search_type).to.eql('query_then_fetch');
    });

    it('should set size', function() {
      var body = angular.fromJson(parts[1]);
      expect(body.size).to.be(500);
    });
  });

  describe('When getting fields', function() {
    var requestOptions, parts, header;

    beforeEach(function() {
      createDatasource({url: 'http://es.com', index: 'metricbeat'});

      ctx.backendSrv.datasourceRequest = function(options) {
        requestOptions = options;
        return ctx.$q.when({data: {
          metricbeat: {
            mappings: {
              metricsets: {
                _all: {},
                properties: {
                  '@timestamp': {type: 'date'},
                  beat: {
                    properties: {
                      name: {
                        fields: {raw: {type: 'keyword'}},
                        type: 'string'
                      },
                      hostname: {type: 'string'},
                    }
                  },
                  system: {
                    properties: {
                      cpu: {
                        properties: {
                          system: {type: 'float'},
                          user: {type: 'float'},
                        }
                      },
                      process: {
                        properties: {
                          cpu: {
                            properties: {
                              total: {type: 'float'}
                            }
                          },
                          name: {type: 'string'},
                        }
                      },
                    }
                  }
                }
              }
            }
          }
        }});
      };
    });

    it('should return nested fields', function() {
      ctx.ds.getFields({
        find: 'fields',
        query: '*'
      }).then((fieldObjects) => {
        var fields = _.map(fieldObjects, 'text');
        expect(fields).to.eql([
          '@timestamp',
          'beat.name.raw',
          'beat.name',
          'beat.hostname',
          'system.cpu.system',
          'system.cpu.user',
          'system.process.cpu.total',
          'system.process.name'
        ]);
      });
      ctx.$rootScope.$apply();
    });

    it('should return fields related to query type', function() {
      ctx.ds.getFields({
        find: 'fields',
        query: '*',
        type: 'number'
      }).then((fieldObjects) => {
        var fields = _.map(fieldObjects, 'text');
        expect(fields).to.eql([
          'system.cpu.system',
          'system.cpu.user',
          'system.process.cpu.total'
        ]);
      });

      ctx.ds.getFields({
        find: 'fields',
        query: '*',
        type: 'date'
      }).then((fieldObjects) => {
        var fields = _.map(fieldObjects, 'text');
        expect(fields).to.eql([
          '@timestamp'
        ]);
      });

      ctx.$rootScope.$apply();
    });
  });

  describe('When issuing aggregation query on es5.x', function() {
    var requestOptions, parts, header;

    beforeEach(function() {
      createDatasource({url: 'http://es.com', index: 'test', jsonData: {esVersion: '5'}});

      ctx.backendSrv.datasourceRequest = function(options) {
        requestOptions = options;
        return ctx.$q.when({data: {responses: []}});
      };

      ctx.ds.query({
        range: { from: moment([2015, 4, 30, 10]), to: moment([2015, 5, 1, 10]) },
        targets: [{
            bucketAggs: [
                {type: 'date_histogram', field: '@timestamp', id: '2'}
            ],
            metrics: [
                {type: 'count'}], query: 'test' }
            ]
      });

      ctx.$rootScope.$apply();
      parts = requestOptions.data.split('\n');
      header = angular.fromJson(parts[0]);
    });

    it('should not set search type to count', function() {
      expect(header.search_type).to.not.eql('count');
    });

    it('should set size to 0', function() {
      var body = angular.fromJson(parts[1]);
      expect(body.size).to.be(0);
    });

  });

  describe('When issuing metricFind query on es5.x', function() {
    var requestOptions, parts, header, body, results;

    beforeEach(function() {
      createDatasource({url: 'http://es.com', index: 'test', jsonData: {esVersion: '5'}});

      ctx.backendSrv.datasourceRequest = function(options) {
        requestOptions = options;
        return ctx.$q.when({
          data: {
            responses: [
              {
                aggregations: {
                  "1": {
                    buckets: [
                      {doc_count: 1, key: 'test'},
                      {doc_count: 2, key: 'test2', key_as_string: 'test2_as_string'},
                    ]
                  }
                }
              }
            ]
          }
        });
      };

      ctx.ds.metricFindQuery('{"find": "terms", "field": "test"}').then(res => {
        results = res;
      });

      ctx.$rootScope.$apply();

      parts = requestOptions.data.split('\n');
      header = angular.fromJson(parts[0]);
      body = angular.fromJson(parts[1]);
    });

    it('should get results', function() {
      expect(results.length).to.eql(2);
    });

    it('should use key or key_as_string', function() {
      expect(results[0].text).to.eql('test');
      expect(results[1].text).to.eql('test2_as_string');
    });

    it('should not set search type to count', function() {
      expect(header.search_type).to.not.eql('count');
    });

    it('should set size to 0', function() {
      expect(body.size).to.be(0);
    });

    it('should not set terms aggregation size to 0', function() {
      expect(body['aggs']['1']['terms'].size).to.not.be(0);
    });
  });

});

