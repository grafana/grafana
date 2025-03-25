import { expectNotAssignable, expectType } from 'tsd';

import { PrometheusApiResponse, PrometheusErrorResponse, PrometheusSuccessResponse } from './api';

test('success response', () => {
  const response = {
    status: 'success',
    data: 'hello, world',
  } satisfies PrometheusApiResponse;

  expectType<PrometheusSuccessResponse>(response);
  expectNotAssignable<PrometheusErrorResponse>(response);
  expect(response).not.toHaveProperty('error');
  expect(response).not.toHaveProperty('errorType');
});

test('error response', () => {
  const response = {
    status: 'error',
    error: 'oops, something went wrong',
    errorType: 'InternalError',
  } satisfies PrometheusApiResponse;

  expectType<PrometheusErrorResponse>(response);
  expectNotAssignable<PrometheusSuccessResponse>(response);
  expect(response).not.toHaveProperty('data');
});
