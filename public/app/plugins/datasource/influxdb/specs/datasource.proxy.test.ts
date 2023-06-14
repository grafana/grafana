import { lastValueFrom, of } from 'rxjs';

import { DataQueryRequest, DataQueryResponse, DataSourceInstanceSettings } from '@grafana/data/src';
import { BackendSrv, BackendSrvRequest, config, FetchResponse, setBackendSrv } from '@grafana/runtime';

import { TemplateSrv } from '../../../../features/templating/template_srv';
import InfluxDatasource from '../datasource';
import { InfluxOptions, InfluxQuery } from '../types';

import {
  mockInfluxDataRequest,
  mockInfluxFetchResponse,
  mockInfluxRetentionPolicyResponse,
  mockInfluxTemplateSrv,
  mockInfluxTSDBQueryResponse,
} from './datasource.proxy.testdata';

const fetchMock = jest.fn().mockReturnValue(of(mockInfluxFetchResponse()));

jest.mock('@grafana/runtime/', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),

  getBackendSrv: () => ({
    fetch: fetchMock,
  }),
}));

// THIS IS REQUIRED TO TEST THE INFLUX BACKEND, otherwise the singleton backendSrv is undefined
setBackendSrv({
  fetch: fetchMock,
} as Partial<BackendSrv> as BackendSrv);

// Setting the feature toggle to test the backend migration
config.featureToggles.influxdbBackendMigration = true;

describe('InfluxDatasource backend (proxy)', () => {
  const ctx: {
    instanceSettings: Partial<DataSourceInstanceSettings<InfluxOptions>>;
    ds?: InfluxDatasource;
  } = {
    instanceSettings: { access: 'proxy', url: 'url', name: 'influxDb', jsonData: { httpMode: 'GET' } },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    ctx.instanceSettings.url = '/api/datasources/proxy/1';
    ctx.ds = new InfluxDatasource(
      ctx.instanceSettings as DataSourceInstanceSettings<InfluxOptions>,
      mockInfluxTemplateSrv as TemplateSrv
    );
  });

  describe('InfluxDatasource.query', () => {
    let requestQuery = [],
      requestMethod: Array<string | undefined> = [],
      requestData = [],
      responses: DataQueryResponse[] = [];

    beforeEach(async () => {
      requestQuery = [];
      requestMethod = [];
      requestData = [];
      responses = [];

      fetchMock.mockImplementation((req: BackendSrvRequest) => {
        requestMethod.push(req.method);
        requestQuery.push(req.data?.queries);
        requestData.push(req.data);
        return of(mockInfluxFetchResponse() as FetchResponse);
      });
    });

    it('queries time series data', async () => {
      ctx.ds!.retentionPolicies = [''];
      const queryString = 'SHOW ME THE FRAMES';
      const request = mockInfluxDataRequest([{ refId: 'A', query: queryString }]) as DataQueryRequest<InfluxQuery>;
      responses.push(await lastValueFrom(ctx.ds!.query(request)));

      expect(responses[0].data[0].fields[0].values).toEqual(mockInfluxTSDBQueryResponse[0].data.values[0]);
      expect(responses[0].data[0].fields[1].values).toEqual(mockInfluxTSDBQueryResponse[0].data.values[1]);
      expect(requestMethod[0]).toEqual('POST');
      expect(requestQuery[0][0].query).toEqual(queryString);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('fetches retention policies if undefined, then queries time series data', async () => {
      ctx!.ds!.database = 'grafana';
      const queryString = 'SHOW ME THE FRAMES';
      const request = mockInfluxDataRequest([{ refId: 'A', query: queryString }]) as DataQueryRequest<InfluxQuery>;
      responses.push(await lastValueFrom(ctx.ds!.query(request)));

      // First request will be to get retention policies
      expect(requestMethod[0]).toEqual('POST');
      expect(requestQuery[0][0].query).toEqual(`SHOW RETENTION POLICIES on "${ctx!.ds!.database}"`);

      // Ensure that the retention policies are set on the datasource
      expect(ctx.ds!.retentionPolicies).toEqual(mockInfluxRetentionPolicyResponse[0].data.values[0]);

      // Second request will be to get the data frames
      expect(requestMethod[1]).toEqual('POST');
      expect(requestQuery[1][0].query).toEqual(queryString);

      // We called fetch twice
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
