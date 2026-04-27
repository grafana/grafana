import { merge } from 'lodash';
import { type DeepPartial } from 'react-hook-form';
import { DatasourceSrvMock } from 'test/mocks/datasource_srv';

import type { DataSourceApi, DataSourceInstanceSettings } from '@grafana/data/types';
import { type FetchError, type FetchResponse } from '@grafana/runtime';

import {
  type Correlation,
  type CreateCorrelationResponse,
  type RemoveCorrelationResponse,
  type UpdateCorrelationResponse,
} from '../types';

export function createFetchCorrelationsResponse<T>(overrides?: DeepPartial<FetchResponse>): FetchResponse<T> {
  return merge(
    {
      data: undefined,
      status: 200,
      url: '',
      config: {
        url: '',
        abortSignal: undefined,
      },
      type: 'basic',
      statusText: 'Ok',
      redirected: false,
      headers: new Headers(),
      ok: true,
    },
    overrides
  );
}

export function createFetchCorrelationsError(overrides?: DeepPartial<FetchError>): FetchError {
  return merge(
    createFetchCorrelationsResponse(),
    {
      status: 500,
      statusText: 'Internal Server Error',
      ok: false,
    },
    overrides
  );
}

export function createCreateCorrelationResponse(correlation: Correlation): CreateCorrelationResponse {
  return {
    message: 'Correlation created',
    result: correlation,
  };
}

export function createUpdateCorrelationResponse(correlation: Correlation): UpdateCorrelationResponse {
  return {
    message: 'Correlation updated',
    result: correlation,
  };
}

export function createRemoveCorrelationResponse(): RemoveCorrelationResponse {
  return {
    message: 'Correlation removed',
  };
}

export class MockDataSourceSrv extends DatasourceSrvMock {
  private ds: DataSourceInstanceSettings[];
  constructor(datasources: Record<string, DataSourceInstanceSettings>) {
    super({} as DataSourceApi, {});
    this.ds = Object.values(datasources);
  }
  getList(): DataSourceInstanceSettings[] {
    return this.ds;
  }
  getInstanceSettings(name?: string): DataSourceInstanceSettings | undefined {
    return name ? this.ds.find((ds) => ds.name === name) : undefined;
  }
}
