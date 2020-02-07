import { GraphiteDatasource } from '../datasource';
import _ from 'lodash';

import { TemplateSrv } from 'app/features/templating/template_srv';
import { dateTime } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

describe('graphiteDatasource', () => {
  const datasourceRequestMock = jest.spyOn(backendSrv, 'datasourceRequest');

  const ctx: any = {
    // @ts-ignore
    templateSrv: new TemplateSrv(),
    instanceSettings: { url: 'url', name: 'graphiteProd', jsonData: {} },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    ctx.instanceSettings.url = '/api/datasources/proxy/1';
    ctx.ds = new GraphiteDatasource(ctx.instanceSettings, ctx.templateSrv);
  });

  describe('When querying graphite with one target using query editor target spec', () => {
    const query = {
      panelId: 3,
      dashboardId: 5,
      rangeRaw: { from: 'now-1h', to: 'now' },
      targets: [{ target: 'prod1.count' }, { target: 'prod2.count' }],
      maxDataPoints: 500,
    };

    let results: any;
    let requestOptions: any;

    beforeEach(async () => {
      datasourceRequestMock.mockImplementation((options: any) => {
        requestOptions = options;
        return Promise.resolve({
          data: [
            {
              target: 'prod1.count',
              datapoints: [
                [10, 1],
                [12, 1],
              ],
            },
          ],
        });
      });

      await ctx.ds.query(query).then((data: any) => {
        results = data;
      });
    });

    it('X-Dashboard and X-Panel headers to be set!', () => {
      expect(requestOptions.headers['X-Dashboard-Id']).toBe(5);
      expect(requestOptions.headers['X-Panel-Id']).toBe(3);
    });

    it('should generate the correct query', () => {
      expect(requestOptions.url).toBe('/api/datasources/proxy/1/render');
    });

    it('should set unique requestId', () => {
      expect(requestOptions.requestId).toBe('graphiteProd.panelId.3');
    });

    it('should query correctly', () => {
      const params = requestOptions.data.split('&');
      expect(params).toContain('target=prod1.count');
      expect(params).toContain('target=prod2.count');
      expect(params).toContain('from=-1h');
      expect(params).toContain('until=now');
    });

    it('should exclude undefined params', () => {
      const params = requestOptions.data.split('&');
      expect(params).not.toContain('cacheTimeout=undefined');
    });

    it('should return series list', () => {
      expect(results.data.length).toBe(1);
      expect(results.data[0].name).toBe('prod1.count');
    });

    it('should convert to millisecond resolution', () => {
      expect(results.data[0].fields[0].values.get(0)).toBe(10);
    });
  });

  describe('when fetching Graphite Events as annotations', () => {
    let results: any;

    const options = {
      annotation: {
        tags: 'tag1',
      },
      range: {
        from: dateTime(1432288354),
        to: dateTime(1432288401),
      },
      rangeRaw: { from: 'now-24h', to: 'now' },
    };

    describe('and tags are returned as string', () => {
      const response = {
        data: [
          {
            when: 1507222850,
            tags: 'tag1 tag2',
            data: 'some text',
            id: 2,
            what: 'Event - deploy',
          },
        ],
      };

      beforeEach(async () => {
        datasourceRequestMock.mockImplementation((options: any) => {
          return Promise.resolve(response);
        });
        await ctx.ds.annotationQuery(options).then((data: any) => {
          results = data;
        });
      });

      it('should parse the tags string into an array', () => {
        expect(_.isArray(results[0].tags)).toEqual(true);
        expect(results[0].tags.length).toEqual(2);
        expect(results[0].tags[0]).toEqual('tag1');
        expect(results[0].tags[1]).toEqual('tag2');
      });
    });

    describe('and tags are returned as an array', () => {
      const response = {
        data: [
          {
            when: 1507222850,
            tags: ['tag1', 'tag2'],
            data: 'some text',
            id: 2,
            what: 'Event - deploy',
          },
        ],
      };
      beforeEach(() => {
        datasourceRequestMock.mockImplementation((options: any) => {
          return Promise.resolve(response);
        });

        ctx.ds.annotationQuery(options).then((data: any) => {
          results = data;
        });
        // ctx.$rootScope.$apply();
      });

      it('should parse the tags string into an array', () => {
        expect(_.isArray(results[0].tags)).toEqual(true);
        expect(results[0].tags.length).toEqual(2);
        expect(results[0].tags[0]).toEqual('tag1');
        expect(results[0].tags[1]).toEqual('tag2');
      });
    });
  });

  describe('building graphite params', () => {
    it('should return empty array if no targets', () => {
      const results = ctx.ds.buildGraphiteParams({
        targets: [{}],
      });
      expect(results.length).toBe(0);
    });

    it('should uri escape targets', () => {
      const results = ctx.ds.buildGraphiteParams({
        targets: [{ target: 'prod1.{test,test2}' }, { target: 'prod2.count' }],
      });
      expect(results).toContain('target=prod1.%7Btest%2Ctest2%7D');
    });

    it('should replace target placeholder', () => {
      const results = ctx.ds.buildGraphiteParams({
        targets: [{ target: 'series1' }, { target: 'series2' }, { target: 'asPercent(#A,#B)' }],
      });
      expect(results[2]).toBe('target=asPercent(series1%2Cseries2)');
    });

    it('should replace target placeholder for hidden series', () => {
      const results = ctx.ds.buildGraphiteParams({
        targets: [
          { target: 'series1', hide: true },
          { target: 'sumSeries(#A)', hide: true },
          { target: 'asPercent(#A,#B)' },
        ],
      });
      expect(results[0]).toBe('target=' + encodeURIComponent('asPercent(series1,sumSeries(series1))'));
    });

    it('should replace target placeholder when nesting query references', () => {
      const results = ctx.ds.buildGraphiteParams({
        targets: [{ target: 'series1' }, { target: 'sumSeries(#A)' }, { target: 'asPercent(#A,#B)' }],
      });
      expect(results[2]).toBe('target=' + encodeURIComponent('asPercent(series1,sumSeries(series1))'));
    });

    it('should fix wrong minute interval parameters', () => {
      const results = ctx.ds.buildGraphiteParams({
        targets: [{ target: "summarize(prod.25m.count, '25m', 'sum')" }],
      });
      expect(results[0]).toBe('target=' + encodeURIComponent("summarize(prod.25m.count, '25min', 'sum')"));
    });

    it('should fix wrong month interval parameters', () => {
      const results = ctx.ds.buildGraphiteParams({
        targets: [{ target: "summarize(prod.5M.count, '5M', 'sum')" }],
      });
      expect(results[0]).toBe('target=' + encodeURIComponent("summarize(prod.5M.count, '5mon', 'sum')"));
    });

    it('should ignore empty targets', () => {
      const results = ctx.ds.buildGraphiteParams({
        targets: [{ target: 'series1' }, { target: '' }],
      });
      expect(results.length).toBe(2);
    });

    describe('when formatting targets', () => {
      it('does not attempt to glob for one variable', () => {
        ctx.ds.templateSrv.init([
          {
            type: 'query',
            name: 'metric',
            current: { value: ['b'] },
          },
        ]);

        const results = ctx.ds.buildGraphiteParams({
          targets: [{ target: 'my.$metric.*' }],
        });
        expect(results).toStrictEqual(['target=my.b.*', 'format=json']);
      });

      it('globs for more than one variable', () => {
        ctx.ds.templateSrv.init([
          {
            type: 'query',
            name: 'metric',
            current: { value: ['a', 'b'] },
          },
        ]);

        const results = ctx.ds.buildGraphiteParams({
          targets: [{ target: 'my.[[metric]].*' }],
        });
        expect(results).toStrictEqual(['target=my.%7Ba%2Cb%7D.*', 'format=json']);
      });
    });
  });

  describe('querying for template variables', () => {
    let results: any;
    let requestOptions: any;

    beforeEach(() => {
      datasourceRequestMock.mockImplementation((options: any) => {
        requestOptions = options;
        return Promise.resolve({
          data: ['backend_01', 'backend_02'],
        });
      });
    });

    it('should generate tags query', () => {
      ctx.ds.metricFindQuery('tags()').then((data: any) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/tags');
      expect(requestOptions.params.expr).toEqual([]);
      expect(results).not.toBe(null);
    });

    it('should generate tags query with a filter expression', () => {
      ctx.ds.metricFindQuery('tags(server=backend_01)').then((data: any) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/tags');
      expect(requestOptions.params.expr).toEqual(['server=backend_01']);
      expect(results).not.toBe(null);
    });

    it('should generate tags query for an expression with whitespace after', () => {
      ctx.ds.metricFindQuery('tags(server=backend_01 )').then((data: any) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/tags');
      expect(requestOptions.params.expr).toEqual(['server=backend_01']);
      expect(results).not.toBe(null);
    });

    it('should generate tag values query for one tag', () => {
      ctx.ds.metricFindQuery('tag_values(server)').then((data: any) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/values');
      expect(requestOptions.params.tag).toBe('server');
      expect(requestOptions.params.expr).toEqual([]);
      expect(results).not.toBe(null);
    });

    it('should generate tag values query for a tag and expression', () => {
      ctx.ds.metricFindQuery('tag_values(server,server=~backend*)').then((data: any) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/values');
      expect(requestOptions.params.tag).toBe('server');
      expect(requestOptions.params.expr).toEqual(['server=~backend*']);
      expect(results).not.toBe(null);
    });

    it('should generate tag values query for a tag with whitespace after', () => {
      ctx.ds.metricFindQuery('tag_values(server )').then((data: any) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/values');
      expect(requestOptions.params.tag).toBe('server');
      expect(requestOptions.params.expr).toEqual([]);
      expect(results).not.toBe(null);
    });

    it('should generate tag values query for a tag and expression with whitespace after', () => {
      ctx.ds.metricFindQuery('tag_values(server , server=~backend* )').then((data: any) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/values');
      expect(requestOptions.params.tag).toBe('server');
      expect(requestOptions.params.expr).toEqual(['server=~backend*']);
      expect(results).not.toBe(null);
    });

    it('/metrics/find should be POST', () => {
      ctx.ds.templateSrv.init([
        {
          type: 'query',
          name: 'foo',
          current: { value: ['bar'] },
        },
      ]);
      ctx.ds.metricFindQuery('[[foo]]').then((data: any) => {
        results = data;
      });
      expect(requestOptions.url).toBe('/api/datasources/proxy/1/metrics/find');
      expect(requestOptions.method).toEqual('POST');
      expect(requestOptions.headers).toHaveProperty('Content-Type', 'application/x-www-form-urlencoded');
      expect(requestOptions.data).toMatch(`query=bar`);
      expect(requestOptions).toHaveProperty('params');
    });

    it('should interpolate $__searchFilter with searchFilter', () => {
      ctx.ds.metricFindQuery('app.$__searchFilter', { searchFilter: 'backend' }).then((data: any) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/metrics/find');
      expect(requestOptions.params).toEqual({});
      expect(requestOptions.data).toEqual('query=app.backend*');
      expect(results).not.toBe(null);
    });

    it('should interpolate $__searchFilter with default when searchFilter is missing', () => {
      ctx.ds.metricFindQuery('app.$__searchFilter', {}).then((data: any) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/metrics/find');
      expect(requestOptions.params).toEqual({});
      expect(requestOptions.data).toEqual('query=app.*');
      expect(results).not.toBe(null);
    });
  });
});

function accessScenario(name: string, url: string, fn: any) {
  describe('access scenario ' + name, () => {
    const ctx: any = {
      // @ts-ignore
      templateSrv: new TemplateSrv(),
      instanceSettings: { url: 'url', name: 'graphiteProd', jsonData: {} },
    };

    const httpOptions = {
      headers: {},
    };

    describe('when using proxy mode', () => {
      const options = { dashboardId: 1, panelId: 2 };

      it('tracing headers should be added', () => {
        ctx.instanceSettings.url = url;
        const ds = new GraphiteDatasource(ctx.instanceSettings, ctx.templateSrv);
        ds.addTracingHeaders(httpOptions, options);
        fn(httpOptions);
      });
    });
  });
}

accessScenario('with proxy access', '/api/datasources/proxy/1', (httpOptions: any) => {
  expect(httpOptions.headers['X-Dashboard-Id']).toBe(1);
  expect(httpOptions.headers['X-Panel-Id']).toBe(2);
});

accessScenario('with direct access', 'http://localhost:8080', (httpOptions: any) => {
  expect(httpOptions.headers['X-Dashboard-Id']).toBe(undefined);
  expect(httpOptions.headers['X-Panel-Id']).toBe(undefined);
});
