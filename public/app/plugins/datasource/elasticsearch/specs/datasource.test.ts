import _ from 'lodash';
import moment from 'moment';
import angular from 'angular';
import { ElasticDatasource } from '../datasource';

import * as dateMath from 'app/core/utils/datemath';

describe('ElasticDatasource', function() {
  let backendSrv = {
    datasourceRequest: jest.fn(),
  };

  let $rootScope = {
    $on: jest.fn(),
    appEvent: jest.fn(),
  };

  let templateSrv = {
    replace: jest.fn(text => text),
    getAdhocFilters: jest.fn(() => []),
  };

  let timeSrv = {
    time: { from: 'now-1h', to: 'now' },
    timeRange: jest.fn(() => {
      return {
        from: dateMath.parse(this.time.from, false),
        to: dateMath.parse(this.time.to, true),
      };
    }),
    setTime: jest.fn(time => {
      this.time = time;
    }),
  };

  let ctx = <any>{
    $rootScope,
    backendSrv,
  };

  function createDatasource(instanceSettings) {
    instanceSettings.jsonData = instanceSettings.jsonData || {};
    ctx.ds = new ElasticDatasource(instanceSettings, {}, backendSrv, templateSrv, timeSrv);
  }

  describe('When testing datasource with index pattern', function() {
    beforeEach(function() {
      createDatasource({
        url: 'http://es.com',
        index: '[asd-]YYYY.MM.DD',
        jsonData: { interval: 'Daily', esVersion: '2' },
      });
    });

    it('should translate index pattern to current day', function() {
      var requestOptions;
      ctx.backendSrv.datasourceRequest = jest.fn(options => {
        requestOptions = options;
        return Promise.resolve({ data: {} });
      });

      ctx.ds.testDatasource();

      var today = moment.utc().format('YYYY.MM.DD');
      expect(requestOptions.url).toBe('http://es.com/asd-' + today + '/_mapping');
    });
  });

  describe('When issuing metric query with interval pattern', function() {
    var requestOptions, parts, header;

    beforeEach(() => {
      createDatasource({
        url: 'http://es.com',
        index: '[asd-]YYYY.MM.DD',
        jsonData: { interval: 'Daily', esVersion: '2' },
      });

      ctx.backendSrv.datasourceRequest = jest.fn(options => {
        requestOptions = options;
        return Promise.resolve({ data: { responses: [] } });
      });

      ctx.ds.query({
        range: {
          from: moment.utc([2015, 4, 30, 10]),
          to: moment.utc([2015, 5, 1, 10]),
        },
        targets: [
          {
            bucketAggs: [],
            metrics: [{ type: 'raw_document' }],
            query: 'escape\\:test',
          },
        ],
      });

      parts = requestOptions.data.split('\n');
      header = angular.fromJson(parts[0]);
    });

    it('should translate index pattern to current day', function() {
      expect(header.index).toEqual(['asd-2015.05.30', 'asd-2015.05.31', 'asd-2015.06.01']);
    });

    it('should json escape lucene query', function() {
      var body = angular.fromJson(parts[1]);
      expect(body.query.bool.filter[1].query_string.query).toBe('escape\\:test');
    });
  });

  describe('When issuing document query', function() {
    var requestOptions, parts, header;

    beforeEach(function() {
      createDatasource({
        url: 'http://es.com',
        index: 'test',
        jsonData: { esVersion: '2' },
      });

      ctx.backendSrv.datasourceRequest = jest.fn(options => {
        requestOptions = options;
        return Promise.resolve({ data: { responses: [] } });
      });

      ctx.ds.query({
        range: {
          from: moment([2015, 4, 30, 10]),
          to: moment([2015, 5, 1, 10]),
        },
        targets: [
          {
            bucketAggs: [],
            metrics: [{ type: 'raw_document' }],
            query: 'test',
          },
        ],
      });

      parts = requestOptions.data.split('\n');
      header = angular.fromJson(parts[0]);
    });

    it('should set search type to query_then_fetch', function() {
      expect(header.search_type).toEqual('query_then_fetch');
    });

    it('should set size', function() {
      var body = angular.fromJson(parts[1]);
      expect(body.size).toBe(500);
    });
  });

  describe('When getting fields', function() {
    beforeEach(() => {
      createDatasource({ url: 'http://es.com', index: 'metricbeat' });

      ctx.backendSrv.datasourceRequest = jest.fn(options => {
        return Promise.resolve({
          data: {
            metricbeat: {
              mappings: {
                metricsets: {
                  _all: {},
                  properties: {
                    '@timestamp': { type: 'date' },
                    beat: {
                      properties: {
                        name: {
                          fields: { raw: { type: 'keyword' } },
                          type: 'string',
                        },
                        hostname: { type: 'string' },
                      },
                    },
                    system: {
                      properties: {
                        cpu: {
                          properties: {
                            system: { type: 'float' },
                            user: { type: 'float' },
                          },
                        },
                        process: {
                          properties: {
                            cpu: {
                              properties: {
                                total: { type: 'float' },
                              },
                            },
                            name: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });
      });
    });

    it('should return nested fields', function() {
      ctx.ds
        .getFields({
          find: 'fields',
          query: '*',
        })
        .then(fieldObjects => {
          var fields = _.map(fieldObjects, 'text');
          expect(fields).toEqual([
            '@timestamp',
            'beat.name.raw',
            'beat.name',
            'beat.hostname',
            'system.cpu.system',
            'system.cpu.user',
            'system.process.cpu.total',
            'system.process.name',
          ]);
        });
    });

    it('should return fields related to query type', function() {
      ctx.ds
        .getFields({
          find: 'fields',
          query: '*',
          type: 'number',
        })
        .then(fieldObjects => {
          var fields = _.map(fieldObjects, 'text');
          expect(fields).toEqual(['system.cpu.system', 'system.cpu.user', 'system.process.cpu.total']);
        });

      ctx.ds
        .getFields({
          find: 'fields',
          query: '*',
          type: 'date',
        })
        .then(fieldObjects => {
          var fields = _.map(fieldObjects, 'text');
          expect(fields).toEqual(['@timestamp']);
        });
    });
  });

  describe('When issuing aggregation query on es5.x', function() {
    var requestOptions, parts, header;

    beforeEach(function() {
      createDatasource({
        url: 'http://es.com',
        index: 'test',
        jsonData: { esVersion: '5' },
      });

      ctx.backendSrv.datasourceRequest = jest.fn(options => {
        requestOptions = options;
        return Promise.resolve({ data: { responses: [] } });
      });

      ctx.ds.query({
        range: {
          from: moment([2015, 4, 30, 10]),
          to: moment([2015, 5, 1, 10]),
        },
        targets: [
          {
            bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
            metrics: [{ type: 'count' }],
            query: 'test',
          },
        ],
      });

      parts = requestOptions.data.split('\n');
      header = angular.fromJson(parts[0]);
    });

    it('should not set search type to count', function() {
      expect(header.search_type).not.toEqual('count');
    });

    it('should set size to 0', function() {
      var body = angular.fromJson(parts[1]);
      expect(body.size).toBe(0);
    });
  });

  describe('When issuing metricFind query on es5.x', function() {
    var requestOptions, parts, header, body, results;

    beforeEach(() => {
      createDatasource({
        url: 'http://es.com',
        index: 'test',
        jsonData: { esVersion: '5' },
      });

      ctx.backendSrv.datasourceRequest = jest.fn(options => {
        requestOptions = options;
        return Promise.resolve({
          data: {
            responses: [
              {
                aggregations: {
                  '1': {
                    buckets: [
                      { doc_count: 1, key: 'test' },
                      {
                        doc_count: 2,
                        key: 'test2',
                        key_as_string: 'test2_as_string',
                      },
                    ],
                  },
                },
              },
            ],
          },
        });
      });

      ctx.ds.metricFindQuery('{"find": "terms", "field": "test"}').then(res => {
        results = res;
      });

      parts = requestOptions.data.split('\n');
      header = angular.fromJson(parts[0]);
      body = angular.fromJson(parts[1]);
    });

    it('should get results', () => {
      expect(results.length).toEqual(2);
    });

    it('should use key or key_as_string', () => {
      expect(results[0].text).toEqual('test');
      expect(results[1].text).toEqual('test2_as_string');
    });

    it('should not set search type to count', () => {
      expect(header.search_type).not.toEqual('count');
    });

    it('should set size to 0', () => {
      expect(body.size).toBe(0);
    });

    it('should not set terms aggregation size to 0', () => {
      expect(body['aggs']['1']['terms'].size).not.toBe(0);
    });
  });
});
