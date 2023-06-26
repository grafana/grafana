import { merge } from 'lodash';
import { DeepPartial } from 'react-hook-form';

import { FetchError, FetchResponse } from '@grafana/runtime';

import { Correlation, CreateCorrelationResponse, RemoveCorrelationResponse, UpdateCorrelationResponse } from '../types';

export function createFetchCorrelationsResponse<T>(overrides?: DeepPartial<FetchResponse>): FetchResponse<T> {
  return merge(
    {
      data: undefined,
      status: 200,
      url: '',
      config: { url: '' },
      type: 'basic',
      statusText: 'Ok',
      redirected: false,
      headers: {} as unknown as Headers,
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
