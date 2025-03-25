import { expectNotAssignable, expectType } from 'tsd';

import { Response, ErrorResponse, SuccessResponse } from './api';

test('success response', () => {
  const response = {
    status: 'success',
    data: 'hello, world',
  } satisfies Response;

  expectType<SuccessResponse>(response);
  expectNotAssignable<ErrorResponse>(response);
  expect(response).not.toHaveProperty('error');
  expect(response).not.toHaveProperty('errorType');
});

test('error response', () => {
  const response = {
    status: 'error',
    error: 'oops, something went wrong',
    errorType: 'InternalError',
  } satisfies Response;

  expectType<ErrorResponse>(response);
  expectNotAssignable<SuccessResponse>(response);
  expect(response).not.toHaveProperty('data');
});
