import { lastValueFrom, Observable, of } from 'rxjs';

import {
  DataFrame,
  dataFrameToJSON,
  DataSourceInstanceSettings,
  dateTime,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  createDataFrame,
  PluginType,
  CoreApp,
  DataSourceApi,
  DataQueryRequest,
  getTimeZone,
  PluginMetaInfo,
  DataLink,
  NodeGraphDataFrameFieldNames,
} from '@grafana/data';
import {
  BackendDataSourceResponse,
  config,
  FetchResponse,
  setBackendSrv,
  setDataSourceSrv,
  TemplateSrv,
  DataSourceSrv,
  BackendSrv,
} from '@grafana/runtime';
import { BarGaugeDisplayMode, DataQuery, TableCellDisplayMode } from '@grafana/schema';

import { TempoVariableQueryType } from './VariableQueryEditor';
import { createFetchResponse } from './_importedDependencies/test/helpers/createFetchResponse';
import { TraceqlSearchScope } from './dataquery.gen';
import {
  TempoDatasource,
  buildExpr,
  buildLinkExpr,
  getRateAlignedValues,
  makeServiceGraphViewRequest,
  makeTempoLink,
  getFieldConfig,
  getEscapedRegexValues,
  getEscapedValues,
  makeHistogramLink,
  makePromServiceMapRequest,
} from './datasource';
import mockJson from './test/mockJsonResponse.json';
import mockServiceGraph from './test/mockServiceGraph.json';
import { createMetadataRequest, createTempoDatasource } from './test/mocks';
import { initTemplateSrv } from './test/test_utils';
import { TempoJsonData, TempoQuery } from './types';

let mockObservable: () => Observable<unknown>;
jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    getBackendSrv: () => ({
      fetch: mockObservable,
      _request: mockObservable,
    }),
  };
});

describe('Tempo data source', () => {
  // Mock the console error so that running the test suite doesnt throw the error
  const origError = console.error;
  const consoleErrorMock = jest.fn();
  afterEach(() => (console.error = origError));
  beforeEach(() => (console.error = consoleErrorMock));

  describe('runs correctly', () => {
    jest.spyOn(TempoDatasource.prototype, 'isFeatureAvailable').mockImplementation(() => true);
    const handleStreamingQuery = jest.spyOn(TempoDatasource.prototype, 'handleStreamingQuery');
    const request = jest.spyOn(TempoDatasource.prototype, '_request');
    const templateSrv: TemplateSrv = { replace: (s: string) => s } as unknown as TemplateSrv;

    const range = {
      from: dateTime(new Date(2022, 8, 13, 16, 0, 0, 0)),
      to: dateTime(new Date(2022, 8, 13, 16, 15, 0, 0)),
      raw: { from: 'now-15m', to: 'now' },
    };
    const traceqlQuery = {
      targets: [{ refId: 'refid1', queryType: 'traceql', query: '{}' }],
      range,
    };
    const traceqlSearchQuery = {
      targets: [
        {
          refId: 'refid1',
          queryType: 'traceqlSearch',
          filters: [
            {
              id: 'service-name',
              operator: '=',
              scope: TraceqlSearchScope.Resource,
              tag: 'service.name',
              valueType: 'string',
            },
          ],
        },
      ],
      range,
    };

    it('for traceql queries when live is enabled', async () => {
      config.liveEnabled = true;
      const ds = new TempoDatasource(defaultSettings, templateSrv);
      await lastValueFrom(ds.query(traceqlQuery as DataQueryRequest<TempoQuery>));
      expect(handleStreamingQuery).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledTimes(0);
    });

    it('for traceqlSearch queries when live is enabled', async () => {
      config.liveEnabled = true;
      const ds = new TempoDatasource(defaultSettings, templateSrv);
      await lastValueFrom(ds.query(traceqlSearchQuery as DataQueryRequest<TempoQuery>));
      expect(handleStreamingQuery).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledTimes(0);
    });

    it('for traceql queries when live is not enabled', async () => {
      config.liveEnabled = false;
      const ds = new TempoDatasource(defaultSettings, templateSrv);
      await lastValueFrom(ds.query(traceqlQuery as DataQueryRequest<TempoQuery>));
      expect(handleStreamingQuery).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('for traceqlSearch queries when live is not enabled', async () => {
      config.liveEnabled = false;
      const ds = new TempoDatasource(defaultSettings, templateSrv);
      await lastValueFrom(ds.query(traceqlSearchQuery as DataQueryRequest<TempoQuery>));
      expect(handleStreamingQuery).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledTimes(1);
    });
  });

  it('returns empty response when traceId is empty', async () => {
    const templateSrv: TemplateSrv = { replace: jest.fn() } as unknown as TemplateSrv;
    const ds = new TempoDatasource(defaultSettings, templateSrv);
    const response = await lastValueFrom(
      ds.query({
        targets: [{ refId: 'refid1', queryType: 'traceql', query: '' } as Partial<TempoQuery>],
      } as DataQueryRequest<TempoQuery>),
      { defaultValue: 'empty' }
    );
    expect(response).toBe('empty');
  });

  describe('Variables should be interpolated correctly', () => {
    function getQuery(serviceMapQuery: string | string[] = '$interpolationVar'): TempoQuery {
      return {
        refId: 'x',
        queryType: 'traceql',
        query: '$interpolationVarWithPipe',
        serviceMapQuery,
        filters: [
          {
            id: 'service-name',
            operator: '=',
            scope: TraceqlSearchScope.Resource,
            tag: 'service.name',
            value: '$interpolationVarWithPipe',
            valueType: 'string',
          },
          {
            id: 'tagId',
            operator: '=',
            scope: TraceqlSearchScope.Span,
            tag: '$interpolationVar',
            value: '$interpolationVar',
            valueType: 'string',
          },
        ],
      };
    }
    let templateSrv: TemplateSrv;
    const text = 'interpolationText';
    const textWithPipe = 'interpolationTextOne|interpolationTextTwo';

    beforeEach(() => {
      const expectedValues = {
        interpolationVar: 'scopedInterpolationText',
        interpolationText: 'interpolationText',
        interpolationVarWithPipe: 'interpolationTextOne|interpolationTextTwo',
        scopedInterpolationText: 'scopedInterpolationText',
      };
      templateSrv = initTemplateSrv([{ name: 'templateVariable1' }, { name: 'templateVariable2' }], expectedValues);
    });

    it('when moving from dashboard to explore', async () => {
      const expectedValues = {
        interpolationVar: 'interpolationText',
        interpolationText: 'interpolationText',
        interpolationVarWithPipe: 'interpolationTextOne|interpolationTextTwo',
        scopedInterpolationText: 'scopedInterpolationText',
      };
      templateSrv = initTemplateSrv([{ name: 'templateVariable1' }, { name: 'templateVariable2' }], expectedValues);

      const ds = new TempoDatasource(defaultSettings, templateSrv);
      const queries = ds.interpolateVariablesInQueries([getQuery()], {});
      expect(queries[0].query).toBe(textWithPipe);
      expect(queries[0].serviceMapQuery).toBe(text);
      expect(queries[0].filters[0].value).toBe(textWithPipe);
      expect(queries[0].filters[1].value).toBe(text);
      expect(queries[0].filters[1].tag).toBe(text);
    });

    it('when applying template variables', async () => {
      const scopedText = 'scopedInterpolationText';
      const ds = new TempoDatasource(defaultSettings, templateSrv);
      const resp = ds.applyTemplateVariables(getQuery(), {
        interpolationVar: { text: scopedText, value: scopedText },
      });
      expect(resp.query).toBe(textWithPipe);
      expect(resp.filters[0].value).toBe(textWithPipe);
      expect(resp.filters[1].value).toBe(scopedText);
      expect(resp.filters[1].tag).toBe(scopedText);
    });

    it('when serviceMapQuery is an array', async () => {
      const ds = new TempoDatasource(defaultSettings, templateSrv);
      const queries = ds.interpolateVariablesInQueries([getQuery(['$interpolationVar', '$interpolationVar'])], {});
      expect(queries[0].serviceMapQuery?.[0]).toBe('scopedInterpolationText');
      expect(queries[0].serviceMapQuery?.[1]).toBe('scopedInterpolationText');
    });
  });

  it('parses json fields from backend', async () => {
    setupBackendSrv(
      createDataFrame({
        fields: [
          { name: 'traceID', values: ['04450900759028499335'] },
          { name: 'spanID', values: ['4322526419282105830'] },
          { name: 'parentSpanID', values: [''] },
          { name: 'operationName', values: ['store.validateQueryTimeRange'] },
          { name: 'startTime', values: [1619712655875.4539] },
          { name: 'duration', values: [14.984] },
          { name: 'serviceTags', values: [{ key: 'servicetag1', value: 'service' }] },
          { name: 'logs', values: [{ timestamp: 12345, fields: [{ key: 'count', value: 1 }] }] },
          { name: 'tags', values: [{ key: 'tag1', value: 'val1' }] },
          { name: 'serviceName', values: ['service'] },
        ],
      })
    );
    const templateSrv = { replace: jest.fn() } as unknown as TemplateSrv;
    const ds = new TempoDatasource(defaultSettings, templateSrv);
    const response = await lastValueFrom(
      ds.query({ targets: [{ refId: 'refid1', query: '12345' }] } as DataQueryRequest<TempoQuery>)
    );

    expect(
      (response.data[0] as DataFrame).fields.map((f) => ({
        name: f.name,
        values: f.values,
      }))
    ).toMatchObject([
      { name: 'traceID', values: ['04450900759028499335'] },
      { name: 'spanID', values: ['4322526419282105830'] },
      { name: 'parentSpanID', values: [''] },
      { name: 'operationName', values: ['store.validateQueryTimeRange'] },
      { name: 'startTime', values: [1619712655875.4539] },
      { name: 'duration', values: [14.984] },
      { name: 'serviceTags', values: [{ key: 'servicetag1', value: 'service' }] },
      { name: 'logs', values: [{ timestamp: 12345, fields: [{ key: 'count', value: 1 }] }] },
      { name: 'tags', values: [{ key: 'tag1', value: 'val1' }] },
      { name: 'serviceName', values: ['service'] },
    ]);

    expect(
      (response.data[1] as DataFrame).fields.map((f) => ({
        name: f.name,
        values: f.values,
      }))
    ).toMatchObject([
      { name: 'id', values: ['4322526419282105830'] },
      { name: 'title', values: ['service'] },
      { name: 'subtitle', values: ['store.validateQueryTimeRange'] },
      { name: 'mainstat', values: ['14.98ms (100%)'] },
      { name: 'secondarystat', values: ['14.98ms (100%)'] },
      { name: 'color', values: [1.000007560204647] },
    ]);

    expect(
      (response.data[2] as DataFrame).fields.map((f) => ({
        name: f.name,
        values: f.values,
      }))
    ).toMatchObject([
      { name: 'id', values: [] },
      { name: 'target', values: [] },
      { name: 'source', values: [] },
    ]);
  });

  it('should handle json file upload', async () => {
    const ds = new TempoDatasource(defaultSettings);
    ds.uploadedJson = JSON.stringify(mockJson);
    const response = await lastValueFrom(
      ds.query({
        targets: [{ queryType: 'upload', refId: 'A' }],
      } as DataQueryRequest<TempoQuery>)
    );
    const field = response.data[0].fields[0];
    expect(field.name).toBe('traceID');
    expect(field.type).toBe(FieldType.string);
    expect(field.values[0]).toBe('000000000000000060ba2abb44f13eae');
    expect(field.values.length).toBe(6);
  });

  it('should fail on invalid json file upload', async () => {
    const ds = new TempoDatasource(defaultSettings);
    ds.uploadedJson = JSON.stringify(mockInvalidJson);
    const response = await lastValueFrom(
      ds.query({
        targets: [{ queryType: 'upload', refId: 'A' }],
      } as DataQueryRequest<TempoQuery>)
    );
    expect(response.error?.message).toBeDefined();
    expect(response.data.length).toBe(0);
  });

  it('should handle service graph upload', async () => {
    const ds = new TempoDatasource(defaultSettings);
    ds.uploadedJson = JSON.stringify(mockServiceGraph);
    const response = await lastValueFrom(
      ds.query({
        targets: [{ queryType: 'upload', refId: 'A' }],
      } as DataQueryRequest<TempoQuery>)
    );
    expect(response.data).toHaveLength(2);
    const nodesFrame = response.data[0];
    expect(nodesFrame.name).toBe('Nodes');
    expect(nodesFrame.meta?.preferredVisualisationType).toBe('nodeGraph');

    const edgesFrame = response.data[1];
    expect(edgesFrame.name).toBe('Edges');
    expect(edgesFrame.meta?.preferredVisualisationType).toBe('nodeGraph');
  });

  describe('test the testDatasource function', () => {
    it('should return a success msg if response.ok is true', async () => {
      mockObservable = () => of({ ok: true });
      const handleStreamingQuery = jest
        .spyOn(TempoDatasource.prototype, 'handleStreamingQuery')
        .mockImplementation(() => of({ data: [] }));

      const ds = new TempoDatasource(defaultSettings);
      const response = await ds.testDatasource();
      expect(response.status).toBe('success');
      expect(handleStreamingQuery).toHaveBeenCalled();
    });
  });

  describe('test the metadataRequest function', () => {
    it('should return the last value from the observed stream', async () => {
      mockObservable = () => of('321', '123', '456');
      const ds = new TempoDatasource(defaultSettings);
      const response = await ds.metadataRequest('/api/search/tags');
      expect(response).toBe('456');
    });
  });

  it('should include time shift when querying for traceID', () => {
    const ds = new TempoDatasource({
      ...defaultSettings,
      jsonData: { traceQuery: { timeShiftEnabled: true, spanStartTimeShift: '2m', spanEndTimeShift: '4m' } },
    });

    const range = {
      from: dateTime(new Date(2022, 8, 13, 16, 0, 0, 0)),
      to: dateTime(new Date(2022, 8, 13, 16, 15, 0, 0)),
      raw: { from: 'now-15m', to: 'now' },
    };

    const request = ds.makeTraceIdRequest(
      {
        requestId: 'test',
        interval: '',
        intervalMs: 5,
        scopedVars: {},
        targets: [],
        timezone: '',
        app: '',
        startTime: 0,
        range,
      },
      [{ refId: 'refid1', queryType: 'traceql', query: '' } as TempoQuery]
    );

    expect(request.range.from.valueOf()).toBe(new Date(2022, 8, 13, 15, 58, 0, 0).valueOf());
    expect(request.range.to.valueOf()).toBe(new Date(2022, 8, 13, 16, 19, 0, 0).valueOf());

    // Making sure we don't modify the original range
    expect(range.from.valueOf()).toBe(new Date(2022, 8, 13, 16, 0, 0, 0).valueOf());
    expect(range.to.valueOf()).toBe(new Date(2022, 8, 13, 16, 15, 0, 0).valueOf());
  });

  it('should not include time shift when querying for traceID and time shift config is off', () => {
    const ds = new TempoDatasource({
      ...defaultSettings,
      jsonData: { traceQuery: { timeShiftEnabled: false, spanStartTimeShift: '2m', spanEndTimeShift: '4m' } },
    });

    const request = ds.makeTraceIdRequest(
      {
        requestId: 'test',
        interval: '',
        intervalMs: 5,
        scopedVars: {},
        targets: [],
        timezone: '',
        app: '',
        startTime: 0,
        range: {
          from: dateTime(new Date(2022, 8, 13, 16, 0, 0, 0)),
          to: dateTime(new Date(2022, 8, 13, 16, 15, 0, 0)),
          raw: { from: 'now-15m', to: 'now' },
        },
      },
      [{ refId: 'refid1', queryType: 'traceql', query: '' } as TempoQuery]
    );

    expect(request.range.from.unix()).toBe(dateTime(0).unix());
    expect(request.range.to.unix()).toBe(dateTime(0).unix());
  });
});

describe('Tempo service graph view', () => {
  it('runs service graph queries', async () => {
    const ds = new TempoDatasource({
      ...defaultSettings,
      jsonData: {
        serviceMap: {
          datasourceUid: 'prom',
        },
      },
    });
    setDataSourceSrv(dataSourceSrvWithPrometheus(prometheusMock()));
    const response = await lastValueFrom(
      ds.query({
        targets: [{ queryType: 'serviceMap' }],
        range: getDefaultTimeRange(),
        app: CoreApp.Explore,
      } as DataQueryRequest<TempoQuery>)
    );

    expect(response.data).toHaveLength(3);
    expect(response.state).toBe(LoadingState.Done);

    // Service Graph view
    expect(response.data[0].fields[0].name).toBe('Name');
    expect(response.data[0].fields[0].values.length).toBe(2);
    expect(response.data[0].fields[0].values[0]).toBe('HTTP Client');
    expect(response.data[0].fields[0].values[1]).toBe('HTTP GET - root');

    expect(response.data[0].fields[1].name).toBe('Rate');
    expect(response.data[0].fields[1].values.length).toBe(2);
    expect(response.data[0].fields[1].values[0]).toBe(12.75164671814457);
    expect(response.data[0].fields[1].values[1]).toBe(12.121331111401608);
    expect(response.data[0].fields[1]?.config?.decimals).toBe(2);
    expect(response.data[0].fields[1]?.config?.links?.[0]?.title).toBe('Rate');
    expect(response.data[0].fields[1]?.config?.links?.[0]?.internal?.query.expr).toBe(
      'sum(rate(traces_spanmetrics_calls_total{span_name="${__data.fields[0]}"}[$__rate_interval]))'
    );
    expect(response.data[0].fields[1]?.config?.links?.[0]?.internal?.query.range).toBe(true);
    expect(response.data[0].fields[1]?.config?.links?.[0]?.internal?.query.exemplar).toBe(true);
    expect(response.data[0].fields[1]?.config?.links?.[0]?.internal?.query.instant).toBe(false);

    expect(response.data[0].fields[2].values.length).toBe(2);
    expect(response.data[0].fields[2].values[0]).toBe(12.75164671814457);
    expect(response.data[0].fields[2].values[1]).toBe(12.121331111401608);
    expect(response.data[0].fields[2]?.config?.color?.mode).toBe('continuous-BlPu');
    expect(response.data[0].fields[2]?.config?.custom.cellOptions.mode).toBe(BarGaugeDisplayMode.Lcd);
    expect(response.data[0].fields[2]?.config?.custom.cellOptions.type).toBe(TableCellDisplayMode.Gauge);
    expect(response.data[0].fields[2]?.config?.decimals).toBe(3);

    expect(response.data[0].fields[3].name).toBe('Error Rate');
    expect(response.data[0].fields[3].values.length).toBe(2);
    expect(response.data[0].fields[3].values[0]).toBe(3.75164671814457);
    expect(response.data[0].fields[3].values[1]).toBe(3.121331111401608);
    expect(response.data[0].fields[3]?.config?.decimals).toBe(2);
    expect(response.data[0].fields[3]?.config?.links?.[0]?.title).toBe('Error Rate');
    expect(response.data[0].fields[3]?.config?.links?.[0]?.internal?.query.expr).toBe(
      'sum(rate(traces_spanmetrics_calls_total{status_code="STATUS_CODE_ERROR",span_name="${__data.fields[0]}"}[$__rate_interval]))'
    );
    expect(response.data[0].fields[3]?.config?.links?.[0]?.internal?.query.range).toBe(true);
    expect(response.data[0].fields[3]?.config?.links?.[0]?.internal?.query.exemplar).toBe(true);
    expect(response.data[0].fields[3]?.config?.links?.[0]?.internal?.query.instant).toBe(false);

    expect(response.data[0].fields[4].values.length).toBe(2);
    expect(response.data[0].fields[4].values[0]).toBe(3.75164671814457);
    expect(response.data[0].fields[4].values[1]).toBe(3.121331111401608);
    expect(response.data[0].fields[4]?.config?.color?.mode).toBe('continuous-RdYlGr');
    expect(response.data[0].fields[4]?.config?.custom.cellOptions.mode).toBe(BarGaugeDisplayMode.Lcd);
    expect(response.data[0].fields[4]?.config?.custom.cellOptions.type).toBe(TableCellDisplayMode.Gauge);
    expect(response.data[0].fields[4]?.config?.decimals).toBe(3);

    expect(response.data[0].fields[5].name).toBe('Duration (p90)');
    expect(response.data[0].fields[5].values.length).toBe(2);
    expect(response.data[0].fields[5].values[0]).toBe('0');
    expect(response.data[0].fields[5].values[1]).toBe(0.12003505696757232);
    expect(response.data[0].fields[5]?.config?.unit).toBe('s');
    expect(response.data[0].fields[5]?.config?.links?.[0]?.title).toBe('Duration');
    expect(response.data[0].fields[5]?.config?.links?.[0]?.internal?.query.expr).toBe(
      'histogram_quantile(.9, sum(rate(traces_spanmetrics_latency_bucket{span_name="${__data.fields[0]}"}[$__rate_interval])) by (le))'
    );
    expect(response.data[0].fields[5]?.config?.links?.[0]?.internal?.query.range).toBe(true);
    expect(response.data[0].fields[5]?.config?.links?.[0]?.internal?.query.exemplar).toBe(true);
    expect(response.data[0].fields[5]?.config?.links?.[0]?.internal?.query.instant).toBe(false);

    expect(response.data[0].fields[6]?.config?.links?.[0].url).toBe('');
    expect(response.data[0].fields[6]?.config?.links?.[0].title).toBe('Tempo');
    expect(response.data[0].fields[6]?.config?.links?.[0].internal.query.queryType).toBe('traceqlSearch');
    expect(response.data[0].fields[6]?.config?.links?.[0].internal.query.filters[0].value).toBe('${__data.fields[0]}');

    // Service graph
    expect(response.data[1].name).toBe('Nodes');
    expect(response.data[1].fields[0].values.length).toBe(3);
    expect(response.data[1].fields[0]?.config?.links?.length).toBeGreaterThan(0);
    expect(response.data[1].fields[0]?.config?.links).toEqual(serviceGraphLinks);

    const viewServicesLink = response.data[1].fields[0]?.config?.links.find(
      (link: DataLink) => link.title === 'View traces'
    );
    expect(viewServicesLink).toBeDefined();
    expect(viewServicesLink.internal.query({ replaceVariables: replaceVariablesInstrumented })).toEqual({
      refId: 'A',
      queryType: 'traceqlSearch',
      filters: [
        {
          id: 'service-name',
          operator: '=',
          scope: 'resource',
          tag: 'service.name',
          value: 'my-service',
          valueType: 'string',
        },
      ],
    });
    expect(viewServicesLink.internal.query({ replaceVariables: replaceVariablesUninstrumented })).toEqual({
      refId: 'A',
      queryType: 'traceql',
      filters: [],
      query:
        '{span.db.name="my-service" || span.db.system="my-service" || span.peer.service="my-service" || span.messaging.system="my-service" || span.net.peer.name="my-service"}',
    });

    expect(response.data[2].name).toBe('Edges');
    expect(response.data[2].fields[0].values.length).toBe(2);
  });

  it('runs correct queries with single serviceMapQuery defined', async () => {
    const ds = new TempoDatasource({
      ...defaultSettings,
      jsonData: {
        serviceMap: {
          datasourceUid: 'prom',
        },
      },
    });
    const promMock = prometheusMock();
    setDataSourceSrv(dataSourceSrvWithPrometheus(promMock));
    const response = await lastValueFrom(
      ds.query({
        targets: [{ queryType: 'serviceMap', serviceMapQuery: '{ foo="bar" }', refId: 'foo', filters: [] }],
        range: getDefaultTimeRange(),
        app: CoreApp.Explore,
        requestId: '1',
        interval: '60s',
        intervalMs: 60000,
        scopedVars: {},
        startTime: Date.now(),
        timezone: getTimeZone(),
      })
    );

    expect(response.data).toHaveLength(2);
    expect(response.state).toBe(LoadingState.Done);
    expect(response.data[0].name).toBe('Nodes');
    expect(response.data[1].name).toBe('Edges');
    expect(promMock.query).toHaveBeenCalledTimes(3);
    const nthQuery = (n: number) =>
      (promMock.query as jest.MockedFn<jest.MockableFunction>).mock.calls[n][0] as DataQueryRequest<PromQuery>;
    expect(nthQuery(0).targets[0].expr).toBe(
      'sum by (client, server) (rate(traces_service_graph_request_server_seconds_sum{ foo="bar" }[$__range]))'
    );
    expect(nthQuery(0).targets[1].expr).toBe(
      'group by (client, connection_type, server) (traces_service_graph_request_server_seconds_sum{ foo="bar" })'
    );
    expect(nthQuery(0).targets[2].expr).toBe(
      'sum by (client, server) (rate(traces_service_graph_request_total{ foo="bar" }[$__range]))'
    );
    expect(nthQuery(0).targets[3].expr).toBe(
      'group by (client, connection_type, server) (traces_service_graph_request_total{ foo="bar" })'
    );
    expect(nthQuery(0).targets[4].expr).toBe(
      'sum by (client, server) (rate(traces_service_graph_request_failed_total{ foo="bar" }[$__range]))'
    );
    expect(nthQuery(0).targets[5].expr).toBe(
      'group by (client, connection_type, server) (traces_service_graph_request_failed_total{ foo="bar" })'
    );
    expect(nthQuery(0).targets[6].expr).toBe(
      'sum by (client, server) (rate(traces_service_graph_request_server_seconds_bucket{ foo="bar" }[$__range]))'
    );
    expect(nthQuery(0).targets[7].expr).toBe(
      'group by (client, connection_type, server) (traces_service_graph_request_server_seconds_bucket{ foo="bar" })'
    );
  });

  it('runs correct queries with multiple serviceMapQuery defined', async () => {
    const ds = new TempoDatasource({
      ...defaultSettings,
      jsonData: {
        serviceMap: {
          datasourceUid: 'prom',
        },
      },
    });
    const promMock = prometheusMock();
    setDataSourceSrv(dataSourceSrvWithPrometheus(promMock));
    const response = await lastValueFrom(
      ds.query({
        targets: [
          { queryType: 'serviceMap', serviceMapQuery: ['{ foo="bar" }', '{baz="bad"}'], refId: 'foo', filters: [] },
        ],
        requestId: '1',
        interval: '60s',
        intervalMs: 60000,
        scopedVars: {},
        startTime: Date.now(),
        timezone: getTimeZone(),
        range: getDefaultTimeRange(),
        app: CoreApp.Explore,
      })
    );

    expect(response.data).toHaveLength(2);
    expect(response.state).toBe(LoadingState.Done);
    expect(response.data[0].name).toBe('Nodes');
    expect(response.data[1].name).toBe('Edges');
    expect(promMock.query).toHaveBeenCalledTimes(3);
    const nthQuery = (n: number) =>
      (promMock.query as jest.MockedFn<jest.MockableFunction>).mock.calls[n][0] as DataQueryRequest<PromQuery>;
    expect(nthQuery(0).targets[0].expr).toBe(
      'sum by (client, server) (rate(traces_service_graph_request_server_seconds_sum{ foo="bar" }[$__range])) OR sum by (client, server) (rate(traces_service_graph_request_server_seconds_sum{baz="bad"}[$__range]))'
    );
    expect(nthQuery(0).targets[1].expr).toBe(
      'group by (client, connection_type, server) (traces_service_graph_request_server_seconds_sum{ foo="bar" }) OR group by (client, connection_type, server) (traces_service_graph_request_server_seconds_sum{baz="bad"})'
    );
    expect(nthQuery(0).targets[2].expr).toBe(
      'sum by (client, server) (rate(traces_service_graph_request_total{ foo="bar" }[$__range])) OR sum by (client, server) (rate(traces_service_graph_request_total{baz="bad"}[$__range]))'
    );
    expect(nthQuery(0).targets[3].expr).toBe(
      'group by (client, connection_type, server) (traces_service_graph_request_total{ foo="bar" }) OR group by (client, connection_type, server) (traces_service_graph_request_total{baz="bad"})'
    );
    expect(nthQuery(0).targets[4].expr).toBe(
      'sum by (client, server) (rate(traces_service_graph_request_failed_total{ foo="bar" }[$__range])) OR sum by (client, server) (rate(traces_service_graph_request_failed_total{baz="bad"}[$__range]))'
    );
    expect(nthQuery(0).targets[5].expr).toBe(
      'group by (client, connection_type, server) (traces_service_graph_request_failed_total{ foo="bar" }) OR group by (client, connection_type, server) (traces_service_graph_request_failed_total{baz="bad"})'
    );
    expect(nthQuery(0).targets[6].expr).toBe(
      'sum by (client, server) (rate(traces_service_graph_request_server_seconds_bucket{ foo="bar" }[$__range])) OR sum by (client, server) (rate(traces_service_graph_request_server_seconds_bucket{baz="bad"}[$__range]))'
    );
    expect(nthQuery(0).targets[7].expr).toBe(
      'group by (client, connection_type, server) (traces_service_graph_request_server_seconds_bucket{ foo="bar" }) OR group by (client, connection_type, server) (traces_service_graph_request_server_seconds_bucket{baz="bad"})'
    );
  });

  it('should build expr correctly', () => {
    let targets = { targets: [{ queryType: 'serviceMap' }] } as DataQueryRequest<TempoQuery>;
    let builtQuery = buildExpr(
      { expr: 'sum(rate(traces_spanmetrics_calls_total{}[$__range])) by (span_name)', params: [], topk: 5 },
      '',
      targets
    );
    expect(builtQuery).toBe('topk(5, sum(rate(traces_spanmetrics_calls_total{}[$__range])) by (span_name))');

    builtQuery = buildExpr(
      {
        expr: 'sum(rate(traces_spanmetrics_calls_total{}[$__range])) by (span_name)',
        params: ['status_code="STATUS_CODE_ERROR"'],
        topk: 5,
      },
      'span_name=~"HTTP Client|HTTP GET|HTTP GET - root|HTTP POST|HTTP POST - post"',
      targets
    );
    expect(builtQuery).toBe(
      'topk(5, sum(rate(traces_spanmetrics_calls_total{status_code="STATUS_CODE_ERROR",span_name=~"HTTP Client|HTTP GET|HTTP GET - root|HTTP POST|HTTP POST - post"}[$__range])) by (span_name))'
    );

    builtQuery = buildExpr(
      {
        expr: 'histogram_quantile(.9, sum(rate(traces_spanmetrics_latency_bucket{}[$__range])) by (le))',
        params: ['status_code="STATUS_CODE_ERROR"'],
      },
      'span_name=~"HTTP Client"',
      targets
    );
    expect(builtQuery).toBe(
      'histogram_quantile(.9, sum(rate(traces_spanmetrics_latency_bucket{status_code="STATUS_CODE_ERROR",span_name=~"HTTP Client"}[$__range])) by (le))'
    );

    targets = {
      targets: [{ queryType: 'serviceMap', serviceMapQuery: '{client="app",service="app"}' }],
    } as DataQueryRequest<TempoQuery>;
    builtQuery = buildExpr(
      { expr: 'sum(rate(traces_spanmetrics_calls_total{}[$__range])) by (span_name)', params: [], topk: 5 },
      '',
      targets
    );
    expect(builtQuery).toBe(
      'topk(5, sum(rate(traces_spanmetrics_calls_total{service="app",service="app"}[$__range])) by (span_name))'
    );

    targets = {
      targets: [{ queryType: 'serviceMap', serviceMapQuery: '{client="app",service="app"}' }],
    } as DataQueryRequest<TempoQuery>;
    builtQuery = buildExpr(
      { expr: 'topk(5, sum(rate(traces_spanmetrics_calls_total{}[$__range])) by (span_name))', params: [] },
      '',
      targets
    );
    expect(builtQuery).toBe(
      'topk(5, sum(rate(traces_spanmetrics_calls_total{service="app",service="app"}[$__range])) by (span_name))'
    );

    targets = {
      targets: [{ queryType: 'serviceMap', serviceMapQuery: ['{foo="app"}', '{bar="app"}'] }],
    } as DataQueryRequest<TempoQuery>;
    builtQuery = buildExpr(
      { expr: 'sum(rate(traces_spanmetrics_calls_total{}[$__range])) by (span_name)', params: [], topk: 5 },
      '',
      targets
    );
    expect(builtQuery).toBe(
      'topk(5, sum(rate(traces_spanmetrics_calls_total{foo="app"}[$__range])) by (span_name) OR sum(rate(traces_spanmetrics_calls_total{bar="app"}[$__range])) by (span_name))'
    );

    targets = {
      targets: [{ queryType: 'serviceMap', serviceMapQuery: '{client="${app}",service="$app"}' }],
    } as DataQueryRequest<TempoQuery>;
    builtQuery = buildExpr(
      { expr: 'sum(rate(traces_spanmetrics_calls_total{}[$__range])) by (span_name)', params: [], topk: 5 },
      '',
      targets
    );
    expect(builtQuery).toBe(
      'topk(5, sum(rate(traces_spanmetrics_calls_total{service="${app}",service="$app"}[$__range])) by (span_name))'
    );

    targets = {
      targets: [
        { queryType: 'serviceMap', serviceMapQuery: '{client="app",client_deployment_environment="production"}' },
      ],
    } as DataQueryRequest<TempoQuery>;
    builtQuery = buildExpr(
      { expr: 'sum(rate(traces_spanmetrics_calls_total{}[$__range])) by (span_name)', params: [], topk: 5 },
      '',
      targets
    );
    expect(builtQuery).toBe(
      'topk(5, sum(rate(traces_spanmetrics_calls_total{service="app",deployment_environment="production"}[$__range])) by (span_name))'
    );
  });

  it('should build link expr correctly', () => {
    let builtQuery = buildLinkExpr('topk(5, sum(rate(traces_spanmetrics_calls_total{}[$__range])) by (span_name))');
    expect(builtQuery).toBe('sum(rate(traces_spanmetrics_calls_total{}[$__rate_interval]))');
  });

  it('should escape span names correctly', () => {
    const spanNames = [
      '/actuator/health/**',
      '$type + [test]|HTTP POST - post',
      'server.cluster.local:9090^/sample.test(.*)?',
      'test\\path',
    ];
    let escaped = getEscapedRegexValues(getEscapedValues(spanNames));
    expect(escaped).toEqual([
      '/actuator/health/\\\\*\\\\*',
      '\\\\$type \\\\+ \\\\[test\\\\]\\\\|HTTP POST - post',
      'server\\\\.cluster\\\\.local:9090\\\\^/sample\\\\.test\\\\(\\\\.\\\\*\\\\)\\\\?',
      'test\\\\path',
    ]);
  });

  it('should get field config correctly', () => {
    let datasourceUid = 's4Jvz8Qnk';
    let tempoDatasourceUid = 'EbPO1fYnz';
    let targetField = '__data.fields.target';
    let tempoField = '__data.fields.target';
    let sourceField = '__data.fields.source';

    let fieldConfig = getFieldConfig(datasourceUid, tempoDatasourceUid, targetField, tempoField, sourceField);

    let resultObj = {
      links: [
        {
          url: '',
          title: 'Request rate',
          internal: {
            query: {
              expr: 'sum by (client, server)(rate(traces_service_graph_request_total{client="${__data.fields.source}",server="${__data.fields.target}"}[$__rate_interval]))',
              range: true,
              exemplar: true,
              instant: false,
            },
            datasourceUid: 's4Jvz8Qnk',
            datasourceName: '',
          },
        },
        {
          url: '',
          title: 'Request classic histogram',
          internal: {
            query: {
              expr: 'histogram_quantile(0.9, sum(rate(traces_service_graph_request_server_seconds_bucket{client="${__data.fields.source}",server="${__data.fields.target}"}[$__rate_interval])) by (le, client, server))',
              range: true,
              exemplar: true,
              instant: false,
            },
            datasourceUid: 's4Jvz8Qnk',
            datasourceName: '',
          },
        },
        {
          url: '',
          title: 'Failed request rate',
          internal: {
            query: {
              expr: 'sum by (client, server)(rate(traces_service_graph_request_failed_total{client="${__data.fields.source}",server="${__data.fields.target}"}[$__rate_interval]))',
              range: true,
              exemplar: true,
              instant: false,
            },
            datasourceUid: 's4Jvz8Qnk',
            datasourceName: '',
          },
        },
        {
          url: '',
          title: 'View traces',
          internal: {
            datasourceName: '',
            datasourceUid: 'EbPO1fYnz',
            query: expect.any(Function),
          },
        },
      ],
    };
    expect(fieldConfig).toStrictEqual(resultObj);

    const viewServicesLink: DataLink | undefined = fieldConfig.links.find(
      (link: DataLink) => link.title === 'View traces'
    );
    expect(viewServicesLink).toBeDefined();
    expect(viewServicesLink!.internal!.query({ replaceVariables: replaceVariablesInstrumented })).toEqual({
      refId: 'A',
      queryType: 'traceqlSearch',
      filters: [
        {
          id: 'service-name',
          operator: '=',
          scope: 'resource',
          tag: 'service.name',
          value: 'my-target-service',
          valueType: 'string',
        },
      ],
    });
  });

  it('should get field config correctly when namespaces are present', () => {
    let datasourceUid = 's4Jvz8Qnk';
    let tempoDatasourceUid = 'EbPO1fYnz';
    let targetField = '__data.fields.targetName';
    let tempoField = '__data.fields.target';
    let sourceField = '__data.fields.sourceName';
    let namespaceFields = {
      targetNamespace: '__data.fields.targetNamespace',
      sourceNamespace: '__data.fields.sourceNamespace',
    };

    let fieldConfig = getFieldConfig(
      datasourceUid,
      tempoDatasourceUid,
      targetField,
      tempoField,
      sourceField,
      namespaceFields
    );

    let resultObj = {
      links: [
        {
          url: '',
          title: 'Request rate',
          internal: {
            query: {
              expr: 'sum by (client, server, server_service_namespace, client_service_namespace)(rate(traces_service_graph_request_total{client="${__data.fields.sourceName}",client_service_namespace="${__data.fields.sourceNamespace}",server="${__data.fields.targetName}",server_service_namespace="${__data.fields.targetNamespace}"}[$__rate_interval]))',
              range: true,
              exemplar: true,
              instant: false,
            },
            datasourceUid: 's4Jvz8Qnk',
            datasourceName: '',
          },
        },
        {
          url: '',
          title: 'Request classic histogram',
          internal: {
            query: {
              expr: 'histogram_quantile(0.9, sum(rate(traces_service_graph_request_server_seconds_bucket{client="${__data.fields.sourceName}",client_service_namespace="${__data.fields.sourceNamespace}",server="${__data.fields.targetName}",server_service_namespace="${__data.fields.targetNamespace}"}[$__rate_interval])) by (le, client, server, server_service_namespace, client_service_namespace))',
              range: true,
              exemplar: true,
              instant: false,
            },
            datasourceUid: 's4Jvz8Qnk',
            datasourceName: '',
          },
        },
        {
          url: '',
          title: 'Failed request rate',
          internal: {
            query: {
              expr: 'sum by (client, server, server_service_namespace, client_service_namespace)(rate(traces_service_graph_request_failed_total{client="${__data.fields.sourceName}",client_service_namespace="${__data.fields.sourceNamespace}",server="${__data.fields.targetName}",server_service_namespace="${__data.fields.targetNamespace}"}[$__rate_interval]))',
              range: true,
              exemplar: true,
              instant: false,
            },
            datasourceUid: 's4Jvz8Qnk',
            datasourceName: '',
          },
        },
        {
          url: '',
          title: 'View traces',
          internal: {
            datasourceName: '',
            datasourceUid: 'EbPO1fYnz',
            query: expect.any(Function),
          },
        },
      ],
    };
    expect(fieldConfig).toStrictEqual(resultObj);

    const viewServicesLink: DataLink | undefined = fieldConfig.links.find(
      (link: DataLink) => link.title === 'View traces'
    );
    expect(viewServicesLink).toBeDefined();
    expect(viewServicesLink!.internal!.query({ replaceVariables: replaceVariablesInstrumented })).toEqual({
      refId: 'A',
      queryType: 'traceqlSearch',
      filters: [
        {
          id: 'service-namespace',
          operator: '=',
          scope: 'resource',
          tag: 'service.namespace',
          value: 'my-target-namespace-service',
          valueType: 'string',
        },
        {
          id: 'service-name',
          operator: '=',
          scope: 'resource',
          tag: 'service.name',
          value: 'my-target-name-service',
          valueType: 'string',
        },
      ],
    });
  });

  it('should get rate aligned values correctly', () => {
    const resp = [
      {
        refId:
          'topk(5, sum(rate(traces_spanmetrics_calls_total{service="app",service="app"}[$__range])) by (span_name))',
        fields: [
          {
            name: 'Time',
            type: FieldType.time,
            config: {},
            values: [1653828275000, 1653828275000, 1653828275000, 1653828275000, 1653828275000],
          },
          {
            name: 'span_name',
            config: {
              filterable: true,
            },
            type: FieldType.string,
            values: ['HTTP Client', 'HTTP GET', 'HTTP GET - root', 'HTTP POST', 'HTTP POST - post'],
          },
        ],
        values: [],
      },
    ];

    const objToAlign = {
      'HTTP GET - root': {
        value: '0.1234',
      },
      'HTTP GET': {
        value: '0.6789',
      },
      'HTTP POST - post': {
        value: '0.4321',
      },
    };

    let value = getRateAlignedValues(resp, objToAlign);
    expect(value.toString()).toBe('0,0.6789,0.1234,0,0.4321');
  });

  it('should make service graph view request correctly', () => {
    const request = makeServiceGraphViewRequest([
      'topk(5, sum(rate(traces_spanmetrics_calls_total{service="app"}[$__range])) by (span_name))"',
      'histogram_quantile(.9, sum(rate(traces_spanmetrics_latency_bucket{status_code="STATUS_CODE_ERROR",service="app",service="app",span_name=~"HTTP Client"}[$__range])) by (le))',
    ]);
    expect(request).toEqual([
      {
        refId: 'topk(5, sum(rate(traces_spanmetrics_calls_total{service="app"}[$__range])) by (span_name))"',
        expr: 'topk(5, sum(rate(traces_spanmetrics_calls_total{service="app"}[$__range])) by (span_name))"',
        instant: true,
      },
      {
        refId:
          'histogram_quantile(.9, sum(rate(traces_spanmetrics_latency_bucket{status_code="STATUS_CODE_ERROR",service="app",service="app",span_name=~"HTTP Client"}[$__range])) by (le))',
        expr: 'histogram_quantile(.9, sum(rate(traces_spanmetrics_latency_bucket{status_code="STATUS_CODE_ERROR",service="app",service="app",span_name=~"HTTP Client"}[$__range])) by (le))',
        instant: true,
      },
    ]);
  });

  it('should make tempo link correctly without namespace', () => {
    const tempoLink = makeTempoLink('Tempo', undefined, '', '"${__data.fields[0]}"', 'gdev-tempo');
    expect(tempoLink).toEqual({
      url: '',
      title: 'Tempo',
      internal: {
        query: {
          queryType: 'traceqlSearch',
          refId: 'A',
          filters: [
            {
              id: 'span-name',
              operator: '=',
              scope: 'span',
              tag: 'name',
              value: '"${__data.fields[0]}"',
              valueType: 'string',
            },
          ],
        },
        datasourceUid: 'gdev-tempo',
        datasourceName: 'Tempo',
      },
    });
  });

  it('should make tempo link correctly with namespace', () => {
    const tempoLink = makeTempoLink('Tempo', '"${__data.fields.subtitle}"', '', '"${__data.fields[0]}"', 'gdev-tempo');
    expect(tempoLink).toEqual({
      url: '',
      title: 'Tempo',
      internal: {
        query: {
          queryType: 'traceqlSearch',
          refId: 'A',
          filters: [
            {
              id: 'service-namespace',
              operator: '=',
              scope: 'resource',
              tag: 'service.namespace',
              value: '"${__data.fields.subtitle}"',
              valueType: 'string',
            },
            {
              id: 'span-name',
              operator: '=',
              scope: 'span',
              tag: 'name',
              value: '"${__data.fields[0]}"',
              valueType: 'string',
            },
          ],
        },
        datasourceUid: 'gdev-tempo',
        datasourceName: 'Tempo',
      },
    });
  });
});

describe('label names - v2 tags', () => {
  let datasource: TempoDatasource;

  beforeEach(() => {
    datasource = createTempoDatasource();
    jest.spyOn(datasource, 'metadataRequest').mockImplementation(
      createMetadataRequest({
        data: {
          scopes: [{ name: 'span', tags: ['label1', 'label2'] }],
        },
      })
    );
  });

  it('get label names', async () => {
    // label_names()
    const response = await datasource.executeVariableQuery({ refId: 'test', type: TempoVariableQueryType.LabelNames });

    expect(response).toEqual([{ text: 'label1' }, { text: 'label2' }]);
  });
});

describe('label names - v1 tags', () => {
  let datasource: TempoDatasource;

  beforeEach(() => {
    datasource = createTempoDatasource();
    jest
      .spyOn(datasource, 'metadataRequest')
      .mockImplementationOnce(() => {
        throw Error;
      })
      .mockImplementation(
        createMetadataRequest({
          data: {
            tagNames: ['label1', 'label2'],
          },
        })
      );
  });

  it('get label names', async () => {
    // label_names()
    const response = await datasource.executeVariableQuery({ refId: 'test', type: TempoVariableQueryType.LabelNames });
    expect(response).toEqual([{ text: 'label1' }, { text: 'label2' }, { text: 'status.code' }]);
  });
});

describe('label values', () => {
  let datasource: TempoDatasource;

  beforeEach(() => {
    datasource = createTempoDatasource();
    jest.spyOn(datasource, 'metadataRequest').mockImplementation(
      createMetadataRequest({
        data: {
          tagValues: [
            {
              type: 'value1',
              value: 'value1',
              label: 'value1',
            },
            {
              type: 'value2',
              value: 'value2',
              label: 'value2',
            },
          ],
        },
      })
    );
  });

  it('get label values for given label', async () => {
    // label_values("label")
    const response = await datasource.executeVariableQuery({
      refId: 'test',
      type: TempoVariableQueryType.LabelValues,
      label: 'label',
    });

    expect(response).toEqual([
      { text: { type: 'value1', value: 'value1', label: 'value1' } },
      { text: { type: 'value2', value: 'value2', label: 'value2' } },
    ]);
  });

  it('do not raise error when label is not set', async () => {
    // label_values()
    const response = await datasource.executeVariableQuery({
      refId: 'test',
      type: TempoVariableQueryType.LabelValues,
      label: undefined,
    });

    expect(response).toEqual([]);
  });
});

describe('should provide functionality for ad-hoc filters', () => {
  let datasource: TempoDatasource;

  beforeEach(() => {
    datasource = createTempoDatasource();
    jest.spyOn(datasource, 'metadataRequest').mockImplementation(
      createMetadataRequest({
        data: {
          scopes: [{ name: 'span', tags: ['label1', 'label2'] }],
          tagValues: [
            {
              type: 'value1',
              value: 'value1',
              label: 'value1',
            },
            {
              type: 'value2',
              value: 'value2',
              label: 'value2',
            },
          ],
        },
      })
    );
  });

  it('for getTagKeys', async () => {
    const response = await datasource.getTagKeys({
      filters: [],
      timeRange: {
        from: dateTime('2021-04-20T15:55:00Z'),
        to: dateTime('2021-04-20T15:55:00Z'),
        raw: {
          from: 'now-15m',
          to: 'now',
        },
      },
    });
    expect(response).toEqual([{ text: 'span.label1' }, { text: 'span.label2' }]);
  });

  it('for getTagValues', async () => {
    const now = dateTime('2021-04-20T15:55:00Z');
    const options = {
      key: 'span.label1',
      filters: [],
      timeRange: {
        from: now,
        to: now,
        raw: {
          from: 'now-15m',
          to: 'now',
        },
      },
    };
    const response = await datasource.getTagValues(options);
    expect(response).toEqual([{ text: 'value1' }, { text: 'value2' }]);
  });
});

describe('histogram type functionality', () => {
  it('should create correct histogram links for classic histogram type', () => {
    const datasourceUid = 'prom';
    const source = 'client="${__data.fields.source}",';
    const target = 'server="${__data.fields.target}"';
    const serverSumBy = 'server';

    const links = makeHistogramLink(datasourceUid, source, target, serverSumBy);
    expect(links).toHaveLength(1);
    expect(links[0].title).toBe('Request classic histogram');
    expect(links[0].internal.query.expr).toBe(
      'histogram_quantile(0.9, sum(rate(traces_service_graph_request_server_seconds_bucket{client="${__data.fields.source}",server="${__data.fields.target}"}[$__rate_interval])) by (le, client, server))'
    );
  });

  it('should create correct histogram links for native histogram type', () => {
    const datasourceUid = 'prom';
    const source = 'client="${__data.fields.source}",';
    const target = 'server="${__data.fields.target}"';
    const serverSumBy = 'server';

    const links = makeHistogramLink(datasourceUid, source, target, serverSumBy, 'native');
    expect(links).toHaveLength(1);
    expect(links[0].title).toBe('Request native histogram');
    expect(links[0].internal.query.expr).toBe(
      'histogram_quantile(0.9, sum(rate(traces_service_graph_request_server_seconds{client="${__data.fields.source}",server="${__data.fields.target}"}[$__rate_interval])) by (le, client, server))'
    );
  });

  it('should create correct histogram links for both histogram types', () => {
    const datasourceUid = 'prom';
    const source = 'client="${__data.fields.source}",';
    const target = 'server="${__data.fields.target}"';
    const serverSumBy = 'server';

    const links = makeHistogramLink(datasourceUid, source, target, serverSumBy, 'both');
    expect(links).toHaveLength(2);
    expect(links[0].title).toBe('Request classic histogram');
    expect(links[1].title).toBe('Request native histogram');
    expect(links[0].internal.query.expr).toBe(
      'histogram_quantile(0.9, sum(rate(traces_service_graph_request_server_seconds_bucket{client="${__data.fields.source}",server="${__data.fields.target}"}[$__rate_interval])) by (le, client, server))'
    );
    expect(links[1].internal.query.expr).toBe(
      'histogram_quantile(0.9, sum(rate(traces_service_graph_request_server_seconds{client="${__data.fields.source}",server="${__data.fields.target}"}[$__rate_interval])) by (le, client, server))'
    );
  });

  it('should include histogram type in field config', () => {
    const datasourceUid = 'prom';
    const tempoDatasourceUid = 'tempo';
    const targetField = '__data.fields.target';
    const tempoField = '__data.fields.target';
    const sourceField = '__data.fields.source';

    const fieldConfig = getFieldConfig(
      datasourceUid,
      tempoDatasourceUid,
      targetField,
      tempoField,
      sourceField,
      undefined,
      'native'
    );
    const histogramLink = fieldConfig.links.find((link) => link.title === 'Request native histogram');
    expect(histogramLink).toBeDefined();
    expect(histogramLink?.internal?.query).toBeDefined();
    if (histogramLink?.internal?.query && 'expr' in histogramLink.internal.query) {
      expect(histogramLink.internal.query.expr).toBe(
        'histogram_quantile(0.9, sum(rate(traces_service_graph_request_server_seconds{client="${__data.fields.source}",server="${__data.fields.target}"}[$__rate_interval])) by (le, client, server))'
      );
    }
  });

  it('should handle histogram type in service map query', () => {
    const request = makePromServiceMapRequest(
      {
        targets: [{ serviceMapQuery: '{service="test"}' }],
        range: getDefaultTimeRange(),
      } as DataQueryRequest<TempoQuery>,
      'native'
    );

    const bucketMetric = request.targets.find((t: PromQuery) => t.expr.includes('_bucket'));
    expect(bucketMetric).toBeUndefined();

    const nativeMetric = request.targets.find((t: PromQuery) =>
      t.expr.includes('traces_service_graph_request_server_seconds')
    );
    expect(nativeMetric).toBeDefined();
  });
});

const prometheusMock = (): DataSourceApi => {
  return {
    query: jest.fn(() =>
      of({
        data: [
          rateMetric,
          errorRateMetric,
          durationMetric,
          emptyDurationMetric,
          totalsPromMetric,
          secondsPromMetric,
          failedPromMetric,
        ],
      })
    ),
  } as unknown as DataSourceApi;
};

const dataSourceSrvWithPrometheus = (promMock: DataSourceApi) =>
  ({
    async get(uid: string) {
      if (uid === 'prom') {
        return promMock;
      }
      throw new Error('unexpected uid');
    },
    getInstanceSettings(uid: string) {
      if (uid === 'prom') {
        return { name: 'Prometheus' };
      } else if (uid === 'gdev-tempo') {
        return { name: 'Tempo' };
      }
      return '';
    },
  }) as unknown as DataSourceSrv;

function setupBackendSrv(frame: DataFrame) {
  setBackendSrv({
    fetch(): Observable<FetchResponse<BackendDataSourceResponse>> {
      return of(
        createFetchResponse({
          results: {
            refid1: {
              frames: [dataFrameToJSON(frame)],
            },
          },
        })
      );
    },
  } as unknown as BackendSrv);
}

export const defaultSettings: DataSourceInstanceSettings<TempoJsonData> = {
  id: 0,
  uid: 'gdev-tempo',
  type: 'tracing',
  name: 'tempo',
  access: 'proxy',
  meta: {
    id: 'tempo',
    name: 'tempo',
    type: PluginType.datasource,
    info: {} as PluginMetaInfo,
    module: '',
    baseUrl: '',
  },
  jsonData: {
    nodeGraph: {
      enabled: true,
    },
    streamingEnabled: {
      search: true,
    },
  },
  readOnly: false,
};

const rateMetric = createDataFrame({
  refId: 'topk(5, sum(rate(traces_spanmetrics_calls_total{span_kind="SPAN_KIND_SERVER"}[$__range])) by (span_name))',
  fields: [
    { name: 'Time', values: [1653725618609, 1653725618609] },
    { name: 'span_name', values: ['HTTP Client', 'HTTP GET - root'] },
    {
      name: 'Value #topk(5, sum(rate(traces_spanmetrics_calls_total{span_kind="SPAN_KIND_SERVER"}[$__range])) by (span_name))',
      values: [12.75164671814457, 12.121331111401608],
    },
  ],
});

const errorRateMetric = createDataFrame({
  refId:
    'topk(5, sum(rate(traces_spanmetrics_calls_total{status_code="STATUS_CODE_ERROR",span_name=~"HTTP Client|HTTP GET - root"}[$__range])) by (span_name))',
  fields: [
    { name: 'Time', values: [1653725618609, 1653725618609] },
    { name: 'span_name', values: ['HTTP Client', 'HTTP GET - root'] },
    {
      name: 'Value #topk(5, sum(rate(traces_spanmetrics_calls_total{status_code="STATUS_CODE_ERROR"}[$__range])) by (span_name))',
      values: [3.75164671814457, 3.121331111401608],
    },
  ],
});

const durationMetric = createDataFrame({
  refId:
    'histogram_quantile(.9, sum(rate(traces_spanmetrics_latency_bucket{span_name=~"HTTP GET - root"}[$__range])) by (le))',
  fields: [
    { name: 'Time', values: [1653725618609] },
    {
      name: 'Value #histogram_quantile(.9, sum(rate(traces_spanmetrics_latency_bucket{span_name=~"HTTP GET - root"}[$__range])) by (le))',
      values: [0.12003505696757232],
    },
  ],
});

const emptyDurationMetric = createDataFrame({
  refId:
    'histogram_quantile(.9, sum(rate(traces_spanmetrics_latency_bucket{span_name=~"HTTP GET - root"}[$__range])) by (le))',
  fields: [],
});

const totalsPromMetric = createDataFrame({
  refId: 'traces_service_graph_request_total',
  fields: [
    { name: 'Time', values: [1628169788000, 1628169788000] },
    { name: 'client', values: ['app', 'lb'] },
    { name: 'instance', values: ['127.0.0.1:12345', '127.0.0.1:12345'] },
    { name: 'job', values: ['local_scrape', 'local_scrape'] },
    { name: 'server', values: ['db', 'app'] },
    { name: 'tempo_config', values: ['default', 'default'] },
    { name: 'Value #traces_service_graph_request_total', values: [10, 20] },
  ],
});

const secondsPromMetric = createDataFrame({
  refId: 'traces_service_graph_request_server_seconds_sum',
  fields: [
    { name: 'Time', values: [1628169788000, 1628169788000] },
    { name: 'client', values: ['app', 'lb'] },
    { name: 'instance', values: ['127.0.0.1:12345', '127.0.0.1:12345'] },
    { name: 'job', values: ['local_scrape', 'local_scrape'] },
    { name: 'server', values: ['db', 'app'] },
    { name: 'tempo_config', values: ['default', 'default'] },
    { name: 'Value #traces_service_graph_request_server_seconds_sum', values: [10, 40] },
  ],
});

const failedPromMetric = createDataFrame({
  refId: 'traces_service_graph_request_failed_total',
  fields: [
    { name: 'Time', values: [1628169788000, 1628169788000] },
    { name: 'client', values: ['app', 'lb'] },
    { name: 'instance', values: ['127.0.0.1:12345', '127.0.0.1:12345'] },
    { name: 'job', values: ['local_scrape', 'local_scrape'] },
    { name: 'server', values: ['db', 'app'] },
    { name: 'tempo_config', values: ['default', 'default'] },
    { name: 'Value #traces_service_graph_request_failed_total', values: [2, 15] },
  ],
});

const mockInvalidJson = {
  batches: [
    {
      resource: {
        attributes: [],
      },
      instrumentation_library_spans: [
        {
          instrumentation_library: {},
          spans: [
            {
              trace_id: 'AAAAAAAAAABguiq7RPE+rg==',
              span_id: 'cmteMBAvwNA=',
              parentSpanId: 'OY8PIaPbma4=',
              name: 'HTTP GET - root',
              kind: 'SPAN_KIND_SERVER',
              startTimeUnixNano: '1627471657255809000',
              endTimeUnixNano: '1627471657256268000',
              attributes: [
                { key: 'http.status_code', value: { intValue: '200' } },
                { key: 'http.method', value: { stringValue: 'GET' } },
                { key: 'http.url', value: { stringValue: '/' } },
                { key: 'component', value: { stringValue: 'net/http' } },
              ],
              status: {},
            },
          ],
        },
      ],
    },
  ],
};

const serviceGraphLinks = [
  {
    url: '',
    title: 'Request rate',
    internal: {
      query: {
        expr: 'sum by (client, server)(rate(traces_service_graph_request_total{server="${__data.fields.id}"}[$__rate_interval]))',
        instant: false,
        range: true,
        exemplar: true,
      },
      datasourceUid: 'prom',
      datasourceName: 'Prometheus',
    },
  },
  {
    url: '',
    title: 'Request classic histogram',
    internal: {
      query: {
        expr: 'histogram_quantile(0.9, sum(rate(traces_service_graph_request_server_seconds_bucket{server="${__data.fields.id}"}[$__rate_interval])) by (le, client, server))',
        instant: false,
        range: true,
        exemplar: true,
      },
      datasourceUid: 'prom',
      datasourceName: 'Prometheus',
    },
  },
  {
    url: '',
    title: 'Failed request rate',
    internal: {
      query: {
        expr: 'sum by (client, server)(rate(traces_service_graph_request_failed_total{server="${__data.fields.id}"}[$__rate_interval]))',
        instant: false,
        range: true,
        exemplar: true,
      },
      datasourceUid: 'prom',
      datasourceName: 'Prometheus',
    },
  },
  {
    url: '',
    title: 'View traces',
    internal: {
      query: expect.any(Function),
      datasourceUid: 'gdev-tempo',
      datasourceName: 'Tempo',
    },
  },
];

const replaceVariablesInstrumented = (variable: string): string => {
  const variables: Record<string, string> = {
    [`\${__data.fields.${NodeGraphDataFrameFieldNames.id}}`]: 'my-service',
    [`\${__data.fields.${NodeGraphDataFrameFieldNames.target}}`]: 'my-target-service',
    [`\${__data.fields.targetName}`]: 'my-target-name-service',
    [`\${__data.fields.targetNamespace}`]: 'my-target-namespace-service',
    [`\${__data.fields.${NodeGraphDataFrameFieldNames.subTitle}}`]: 'my-namespace',
    [`\${__data.fields.${NodeGraphDataFrameFieldNames.isInstrumented}}`]: 'true',
  };
  return variables[variable];
};

const replaceVariablesUninstrumented = (variable: string): string => {
  const variables: Record<string, string> = {
    [`\${__data.fields.${NodeGraphDataFrameFieldNames.id}}`]: 'my-service',
    [`\${__data.fields.${NodeGraphDataFrameFieldNames.subTitle}}`]: 'my-namespace',
    [`\${__data.fields.${NodeGraphDataFrameFieldNames.isInstrumented}}`]: 'false',
  };
  return variables[variable];
};

interface PromQuery extends DataQuery {
  expr: string;
}
