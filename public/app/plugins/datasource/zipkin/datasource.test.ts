import { lastValueFrom, of } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';

import {
  DataFrameView,
  DataQueryRequest,
  DataSourceInstanceSettings,
  DataSourcePluginMeta,
  FieldType,
} from '@grafana/data';
import { BackendSrv, TemplateSrv } from '@grafana/runtime';

import { addNodeGraphFramesToResponse, ZipkinDatasource } from './datasource';
import mockJson from './mocks/mockJsonResponse.json';
import { mockTraceDataFrame } from './mocks/mockTraceDataFrame';
import { ZipkinQuery, ZipkinSpan } from './types';
import { traceFrameFields, zipkinResponse } from './utils/testData';

export const backendSrv = { fetch: jest.fn() } as unknown as BackendSrv;

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

describe('ZipkinDatasource', () => {
  describe('query', () => {
    const templateSrv: TemplateSrv = {
      replace: jest.fn(),
      getVariables: jest.fn(),
      containsTemplate: jest.fn(),
      updateTimeRange: jest.fn(),
    };

    it('runs query', async () => {
      setupBackendSrv(zipkinResponse);
      const ds = new ZipkinDatasource(defaultSettings, templateSrv);
      await expect(ds.query({ targets: [{ query: '12345' }] } as DataQueryRequest<ZipkinQuery>)).toEmitValuesWith(
        (val) => {
          expect(val[0].data[0].fields).toMatchObject(traceFrameFields);
        }
      );
    });

    it('runs query with traceId that includes special characters', async () => {
      setupBackendSrv(zipkinResponse);
      const ds = new ZipkinDatasource(defaultSettings, templateSrv);
      await expect(ds.query({ targets: [{ query: 'a/b' }] } as DataQueryRequest<ZipkinQuery>)).toEmitValuesWith(
        (val) => {
          expect(val[0].data[0].fields).toMatchObject(traceFrameFields);
        }
      );
    });

    it('should handle json file upload', async () => {
      const ds = new ZipkinDatasource(defaultSettings);
      ds.uploadedJson = JSON.stringify(mockJson);
      const response = await lastValueFrom(
        ds.query({
          targets: [{ queryType: 'upload', refId: 'A' }],
        } as DataQueryRequest<ZipkinQuery>)
      );
      const field = response.data[0].fields[0];
      expect(field.name).toBe('traceID');
      expect(field.type).toBe(FieldType.string);
      expect(field.values.length).toBe(3);
    });

    it('should fail on invalid json file upload', async () => {
      const ds = new ZipkinDatasource(defaultSettings);
      ds.uploadedJson = JSON.stringify({ key: 'value', arr: [] });
      const response = await lastValueFrom(
        ds.query({
          targets: [{ queryType: 'upload', refId: 'A' }],
        } as DataQueryRequest<ZipkinQuery>)
      );
      expect(response.error?.message).toBeDefined();
      expect(response.data.length).toBe(0);
    });
  });

  describe('metadataRequest', () => {
    it('runs query', async () => {
      setupBackendSrv(['service 1', 'service 2'] as unknown as ZipkinSpan[]);
      const ds = new ZipkinDatasource(defaultSettings);
      const response = await ds.metadataRequest('services');
      expect(response).toEqual(['service 1', 'service 2']);
    });
  });
});

describe('addNodeGraphFramesToResponse', () => {
  it('transforms basic response into nodes and edges frame', () => {
    const responseWithNodeFrames = addNodeGraphFramesToResponse({ data: mockTraceDataFrame });
    let view = new DataFrameView(responseWithNodeFrames.data[1]);
    expect(view.get(0)).toMatchObject({
      id: '4322526419282105830',
      title: 'service1',
      subtitle: 'store.validateQueryTimeRange',
      mainstat: '0ms (1.6%)',
      secondarystat: '0ms (100%)',
      color: 0.016,
    });
    expect(view.get(3)).toMatchObject({
      id: '1853508259384889601',
      title: 'service1',
      subtitle: 'Shipper.Uploads.Query',
      mainstat: '0.05ms (18.8%)',
      secondarystat: '0.05ms (100%)',
      color: 0.188,
    });
  });

  it('handles empty response', () => {
    const response = { data: [] };
    const responseWithNodeFrames = addNodeGraphFramesToResponse(response);
    expect(responseWithNodeFrames).toBe(response);
  });
});

function setupBackendSrv(response: ZipkinSpan[]) {
  const defaultMock = () => of(createFetchResponse(response));

  const fetchMock = jest.spyOn(backendSrv, 'fetch');
  fetchMock.mockImplementation(defaultMock);
}

const defaultSettings: DataSourceInstanceSettings = {
  id: 1,
  uid: '1',
  type: 'tracing',
  name: 'zipkin',
  meta: {} as DataSourcePluginMeta,
  jsonData: {},
  access: 'proxy',
  readOnly: false,
};
