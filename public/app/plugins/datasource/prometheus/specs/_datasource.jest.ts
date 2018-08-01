import moment from 'moment';
import { PrometheusDatasource } from '../datasource';
import $q from 'q';
import { angularMocks } from 'test/lib/common';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

const time = ({ hours = 0, seconds = 0, minutes = 0 }) => moment(hours * HOUR + minutes * MINUTE + seconds * SECOND);

let ctx = <any>{};
let instanceSettings = {
  url: 'proxied',
  directUrl: 'direct',
  user: 'test',
  password: 'mupp',
  jsonData: { httpMethod: 'GET' },
};
let backendSrv = <any>{
  datasourceRequest: jest.fn(),
};

let templateSrv = {
  replace: jest.fn(str => str),
};

let timeSrv = {
  timeRange: () => {
    return { to: { diff: () => 2000 }, from: '' };
  },
};

describe('PrometheusDatasource', function() {
  //   beforeEach(angularMocks.module('grafana.core'));
  //   beforeEach(angularMocks.module('grafana.services'));
  //   beforeEach(ctx.providePhase(['timeSrv']));

  //   beforeEach(
  //     angularMocks.inject(function($q, $rootScope, $httpBackend, $injector) {
  //       ctx.$q = $q;
  //       ctx.$httpBackend = $httpBackend;
  //       ctx.$rootScope = $rootScope;
  //       ctx.ds = $injector.instantiate(PrometheusDatasource, {
  //         instanceSettings: instanceSettings,
  //       });
  //       $httpBackend.when('GET', /\.html$/).respond('');
  //     })
  //   );

  describe('When querying prometheus with one target using query editor target spec', async () => {
    var results;
    var query = {
      range: { from: time({ seconds: 63 }), to: time({ seconds: 183 }) },
      targets: [{ expr: 'test{job="testjob"}', format: 'time_series' }],
      interval: '60s',
    };
    // Interval alignment with step
    var urlExpected =
      'proxied/api/v1/query_range?query=' + encodeURIComponent('test{job="testjob"}') + '&start=60&end=240&step=60';

    beforeEach(async () => {
      let response = {
        data: {
          status: 'success',
          data: {
            resultType: 'matrix',
            result: [
              {
                metric: { __name__: 'test', job: 'testjob' },
                values: [[60, '3846']],
              },
            ],
          },
        },
      };
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);

      await ctx.ds.query(query).then(function(data) {
        results = data;
      });
    });

    it('should generate the correct query', function() {
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });
    it('should return series list', async () => {
      expect(results.data.length).toBe(1);
      expect(results.data[0].target).toBe('test{job="testjob"}');
    });
  });
  describe('When querying prometheus with one target which return multiple series', function() {
    var results;
    var start = 60;
    var end = 360;
    var step = 60;

    var query = {
      range: { from: time({ seconds: start }), to: time({ seconds: end }) },
      targets: [{ expr: 'test{job="testjob"}', format: 'time_series' }],
      interval: '60s',
    };

    beforeEach(async () => {
      let response = {
        status: 'success',
        data: {
          data: {
            resultType: 'matrix',
            result: [
              {
                metric: { __name__: 'test', job: 'testjob', series: 'series 1' },
                values: [[start + step * 1, '3846'], [start + step * 3, '3847'], [end - step * 1, '3848']],
              },
              {
                metric: { __name__: 'test', job: 'testjob', series: 'series 2' },
                values: [[start + step * 2, '4846']],
              },
            ],
          },
        },
      };

      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);

      await ctx.ds.query(query).then(function(data) {
        results = data;
      });
    });

    it('should be same length', function() {
      expect(results.data.length).toBe(2);
      expect(results.data[0].datapoints.length).toBe((end - start) / step + 1);
      expect(results.data[1].datapoints.length).toBe((end - start) / step + 1);
    });

    it('should fill null until first datapoint in response', function() {
      expect(results.data[0].datapoints[0][1]).toBe(start * 1000);
      expect(results.data[0].datapoints[0][0]).toBe(null);
      expect(results.data[0].datapoints[1][1]).toBe((start + step * 1) * 1000);
      expect(results.data[0].datapoints[1][0]).toBe(3846);
    });
    it('should fill null after last datapoint in response', function() {
      var length = (end - start) / step + 1;
      expect(results.data[0].datapoints[length - 2][1]).toBe((end - step * 1) * 1000);
      expect(results.data[0].datapoints[length - 2][0]).toBe(3848);
      expect(results.data[0].datapoints[length - 1][1]).toBe(end * 1000);
      expect(results.data[0].datapoints[length - 1][0]).toBe(null);
    });
    it('should fill null at gap between series', function() {
      expect(results.data[0].datapoints[2][1]).toBe((start + step * 2) * 1000);
      expect(results.data[0].datapoints[2][0]).toBe(null);
      expect(results.data[1].datapoints[1][1]).toBe((start + step * 1) * 1000);
      expect(results.data[1].datapoints[1][0]).toBe(null);
      expect(results.data[1].datapoints[3][1]).toBe((start + step * 3) * 1000);
      expect(results.data[1].datapoints[3][0]).toBe(null);
    });
  });
  describe('When querying prometheus with one target and instant = true', function() {
    var results;
    var urlExpected = 'proxied/api/v1/query?query=' + encodeURIComponent('test{job="testjob"}') + '&time=123';
    var query = {
      range: { from: time({ seconds: 63 }), to: time({ seconds: 123 }) },
      targets: [{ expr: 'test{job="testjob"}', format: 'time_series', instant: true }],
      interval: '60s',
    };

    beforeEach(async () => {
      let response = {
        status: 'success',
        data: {
          data: {
            resultType: 'vector',
            result: [
              {
                metric: { __name__: 'test', job: 'testjob' },
                value: [123, '3846'],
              },
            ],
          },
        },
      };

      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);

      await ctx.ds.query(query).then(function(data) {
        results = data;
      });
    });
    it('should generate the correct query', function() {
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });
    it('should return series list', function() {
      expect(results.data.length).toBe(1);
      expect(results.data[0].target).toBe('test{job="testjob"}');
    });
  });
  describe('When performing annotationQuery', function() {
    var results;

    var options = {
      annotation: {
        expr: 'ALERTS{alertstate="firing"}',
        tagKeys: 'job',
        titleFormat: '{{alertname}}',
        textFormat: '{{instance}}',
      },
      range: {
        from: time({ seconds: 63 }),
        to: time({ seconds: 123 }),
      },
    };

    beforeEach(async () => {
      let response = {
        status: 'success',
        data: {
          data: {
            resultType: 'matrix',
            result: [
              {
                metric: {
                  __name__: 'ALERTS',
                  alertname: 'InstanceDown',
                  alertstate: 'firing',
                  instance: 'testinstance',
                  job: 'testjob',
                },
                values: [[123, '1']],
              },
            ],
          },
        },
      };

      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);

      await ctx.ds.annotationQuery(options).then(function(data) {
        results = data;
      });
    });
    it('should return annotation list', function() {
      //   ctx.$rootScope.$apply();
      expect(results.length).toBe(1);
      expect(results[0].tags).toContain('testjob');
      expect(results[0].title).toBe('InstanceDown');
      expect(results[0].text).toBe('testinstance');
      expect(results[0].time).toBe(123 * 1000);
    });
  });

  describe('When resultFormat is table and instant = true', function() {
    var results;
    // var urlExpected = 'proxied/api/v1/query?query=' + encodeURIComponent('test{job="testjob"}') + '&time=123';
    var query = {
      range: { from: time({ seconds: 63 }), to: time({ seconds: 123 }) },
      targets: [{ expr: 'test{job="testjob"}', format: 'time_series', instant: true }],
      interval: '60s',
    };

    beforeEach(async () => {
      let response = {
        status: 'success',
        data: {
          data: {
            resultType: 'vector',
            result: [
              {
                metric: { __name__: 'test', job: 'testjob' },
                value: [123, '3846'],
              },
            ],
          },
        },
      };

      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query).then(function(data) {
        results = data;
      });
    });

    it('should return result', () => {
      expect(results).not.toBe(null);
    });
  });

  describe('The "step" query parameter', function() {
    var response = {
      status: 'success',
      data: {
        data: {
          resultType: 'matrix',
          result: [],
        },
      },
    };

    it('should be min interval when greater than auto interval', async () => {
      let query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'test',
            interval: '10s',
          },
        ],
        interval: '5s',
      };
      let urlExpected = 'proxied/api/v1/query_range?query=test&start=60&end=420&step=10';

      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });

    it('step should never go below 1', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [{ expr: 'test' }],
        interval: '100ms',
      };
      var urlExpected = 'proxied/api/v1/query_range?query=test&start=60&end=420&step=1';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });

    it('should be auto interval when greater than min interval', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'test',
            interval: '5s',
          },
        ],
        interval: '10s',
      };
      var urlExpected = 'proxied/api/v1/query_range?query=test&start=60&end=420&step=10';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });
    it('should result in querying fewer than 11000 data points', async () => {
      var query = {
        // 6 hour range
        range: { from: time({ hours: 1 }), to: time({ hours: 7 }) },
        targets: [{ expr: 'test' }],
        interval: '1s',
      };
      var end = 7 * 60 * 60;
      var start = 60 * 60;
      var urlExpected = 'proxied/api/v1/query_range?query=test&start=' + start + '&end=' + end + '&step=2';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });
    it('should not apply min interval when interval * intervalFactor greater', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'test',
            interval: '10s',
            intervalFactor: 10,
          },
        ],
        interval: '5s',
      };
      // times get rounded up to interval
      var urlExpected = 'proxied/api/v1/query_range?query=test&start=50&end=450&step=50';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });
    it('should apply min interval when interval * intervalFactor smaller', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'test',
            interval: '15s',
            intervalFactor: 2,
          },
        ],
        interval: '5s',
      };
      var urlExpected = 'proxied/api/v1/query_range?query=test' + '&start=60&end=420&step=15';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });
    it('should apply intervalFactor to auto interval when greater', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'test',
            interval: '5s',
            intervalFactor: 10,
          },
        ],
        interval: '10s',
      };
      // times get aligned to interval
      var urlExpected = 'proxied/api/v1/query_range?query=test' + '&start=0&end=500&step=100';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });
    it('should not not be affected by the 11000 data points limit when large enough', async () => {
      var query = {
        // 1 week range
        range: { from: time({}), to: time({ hours: 7 * 24 }) },
        targets: [
          {
            expr: 'test',
            intervalFactor: 10,
          },
        ],
        interval: '10s',
      };
      var end = 7 * 24 * 60 * 60;
      var start = 0;
      var urlExpected = 'proxied/api/v1/query_range?query=test' + '&start=' + start + '&end=' + end + '&step=100';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });
    it('should be determined by the 11000 data points limit when too small', async () => {
      var query = {
        // 1 week range
        range: { from: time({}), to: time({ hours: 7 * 24 }) },
        targets: [
          {
            expr: 'test',
            intervalFactor: 10,
          },
        ],
        interval: '5s',
      };
      var end = 7 * 24 * 60 * 60;
      var start = 0;
      var urlExpected = 'proxied/api/v1/query_range?query=test' + '&start=' + start + '&end=' + end + '&step=60';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });
  });

  describe('The __interval and __interval_ms template variables', function() {
    var response = {
      status: 'success',
      data: {
        data: {
          resultType: 'matrix',
          result: [],
        },
      },
    };

    it('should be unchanged when auto interval is greater than min interval', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'rate(test[$__interval])',
            interval: '5s',
          },
        ],
        interval: '10s',
        scopedVars: {
          __interval: { text: '10s', value: '10s' },
          __interval_ms: { text: 10 * 1000, value: 10 * 1000 },
        },
      };

      var urlExpected =
        'proxied/api/v1/query_range?query=' +
        encodeURIComponent('rate(test[$__interval])') +
        '&start=60&end=420&step=10';

      templateSrv.replace = jest.fn(str => str);
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);

      expect(templateSrv.replace.mock.calls[0][1]).toEqual({
        __interval: {
          text: '10s',
          value: '10s',
        },
        __interval_ms: {
          text: 10000,
          value: 10000,
        },
      });
    });
    it('should be min interval when it is greater than auto interval', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'rate(test[$__interval])',
            interval: '10s',
          },
        ],
        interval: '5s',
        scopedVars: {
          __interval: { text: '5s', value: '5s' },
          __interval_ms: { text: 5 * 1000, value: 5 * 1000 },
        },
      };
      var urlExpected =
        'proxied/api/v1/query_range?query=' +
        encodeURIComponent('rate(test[$__interval])') +
        '&start=60&end=420&step=10';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      templateSrv.replace = jest.fn(str => str);
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);

      expect(templateSrv.replace.mock.calls[0][1]).toEqual({
        __interval: {
          text: '5s',
          value: '5s',
        },
        __interval_ms: {
          text: 5000,
          value: 5000,
        },
      });
    });
    it('should account for intervalFactor', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'rate(test[$__interval])',
            interval: '5s',
            intervalFactor: 10,
          },
        ],
        interval: '10s',
        scopedVars: {
          __interval: { text: '10s', value: '10s' },
          __interval_ms: { text: 10 * 1000, value: 10 * 1000 },
        },
      };
      var urlExpected =
        'proxied/api/v1/query_range?query=' +
        encodeURIComponent('rate(test[$__interval])') +
        '&start=0&end=500&step=100';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      templateSrv.replace = jest.fn(str => str);
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);

      expect(templateSrv.replace.mock.calls[0][1]).toEqual({
        __interval: {
          text: '10s',
          value: '10s',
        },
        __interval_ms: {
          text: 10000,
          value: 10000,
        },
      });

      expect(query.scopedVars.__interval.text).toBe('10s');
      expect(query.scopedVars.__interval.value).toBe('10s');
      expect(query.scopedVars.__interval_ms.text).toBe(10 * 1000);
      expect(query.scopedVars.__interval_ms.value).toBe(10 * 1000);
    });
    it('should be interval * intervalFactor when greater than min interval', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'rate(test[$__interval])',
            interval: '10s',
            intervalFactor: 10,
          },
        ],
        interval: '5s',
        scopedVars: {
          __interval: { text: '5s', value: '5s' },
          __interval_ms: { text: 5 * 1000, value: 5 * 1000 },
        },
      };
      var urlExpected =
        'proxied/api/v1/query_range?query=' +
        encodeURIComponent('rate(test[$__interval])') +
        '&start=50&end=450&step=50';

      templateSrv.replace = jest.fn(str => str);
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);

      expect(templateSrv.replace.mock.calls[0][1]).toEqual({
        __interval: {
          text: '5s',
          value: '5s',
        },
        __interval_ms: {
          text: 5000,
          value: 5000,
        },
      });
    });
    it('should be min interval when greater than interval * intervalFactor', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'rate(test[$__interval])',
            interval: '15s',
            intervalFactor: 2,
          },
        ],
        interval: '5s',
        scopedVars: {
          __interval: { text: '5s', value: '5s' },
          __interval_ms: { text: 5 * 1000, value: 5 * 1000 },
        },
      };
      var urlExpected =
        'proxied/api/v1/query_range?query=' +
        encodeURIComponent('rate(test[$__interval])') +
        '&start=60&end=420&step=15';

      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);

      expect(templateSrv.replace.mock.calls[0][1]).toEqual({
        __interval: {
          text: '5s',
          value: '5s',
        },
        __interval_ms: {
          text: 5000,
          value: 5000,
        },
      });
    });
    it('should be determined by the 11000 data points limit, accounting for intervalFactor', async () => {
      var query = {
        // 1 week range
        range: { from: time({}), to: time({ hours: 7 * 24 }) },
        targets: [
          {
            expr: 'rate(test[$__interval])',
            intervalFactor: 10,
          },
        ],
        interval: '5s',
        scopedVars: {
          __interval: { text: '5s', value: '5s' },
          __interval_ms: { text: 5 * 1000, value: 5 * 1000 },
        },
      };
      var end = 7 * 24 * 60 * 60;
      var start = 0;
      var urlExpected =
        'proxied/api/v1/query_range?query=' +
        encodeURIComponent('rate(test[$__interval])') +
        '&start=' +
        start +
        '&end=' +
        end +
        '&step=60';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      templateSrv.replace = jest.fn(str => str);
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);

      expect(templateSrv.replace.mock.calls[0][1]).toEqual({
        __interval: {
          text: '5s',
          value: '5s',
        },
        __interval_ms: {
          text: 5000,
          value: 5000,
        },
      });
    });
  });
});

describe('PrometheusDatasource for POST', function() {
  //   var ctx = new helpers.ServiceTestContext();
  let instanceSettings = {
    url: 'proxied',
    directUrl: 'direct',
    user: 'test',
    password: 'mupp',
    jsonData: { httpMethod: 'POST' },
  };

  //   beforeEach(angularMocks.module('grafana.core'));
  //   beforeEach(angularMocks.module('grafana.services'));
  //   beforeEach(ctx.providePhase(['timeSrv']));

  //   beforeEach(
  //     // angularMocks.inject(function($q, $rootScope, $httpBackend, $injector) {
  //     //   ctx.$q = $q;
  //     //   ctx.$httpBackend = $httpBackend;
  //     //   ctx.$rootScope = $rootScope;
  //     //   ctx.ds = $injector.instantiate(PrometheusDatasource, { instanceSettings: instanceSettings });
  //     //   $httpBackend.when('GET', /\.html$/).respond('');
  //     // })
  //   );

  describe('When querying prometheus with one target using query editor target spec', function() {
    var results;
    var urlExpected = 'proxied/api/v1/query_range';
    var dataExpected = {
      query: 'test{job="testjob"}',
      start: 1 * 60,
      end: 3 * 60,
      step: 60,
    };
    var query = {
      range: { from: time({ minutes: 1, seconds: 3 }), to: time({ minutes: 2, seconds: 3 }) },
      targets: [{ expr: 'test{job="testjob"}', format: 'time_series' }],
      interval: '60s',
    };

    beforeEach(async () => {
      let response = {
        status: 'success',
        data: {
          data: {
            resultType: 'matrix',
            result: [
              {
                metric: { __name__: 'test', job: 'testjob' },
                values: [[2 * 60, '3846']],
              },
            ],
          },
        },
      };
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, $q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query).then(function(data) {
        results = data;
      });
    });
    it('should generate the correct query', function() {
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('POST');
      expect(res.url).toBe(urlExpected);
      expect(res.data).toEqual(dataExpected);
    });
    it('should return series list', function() {
      expect(results.data.length).toBe(1);
      expect(results.data[0].target).toBe('test{job="testjob"}');
    });
  });
});
