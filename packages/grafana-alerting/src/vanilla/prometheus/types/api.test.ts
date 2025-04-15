import { expectTypeOf } from 'expect-type';

import { ErrorResponse, SuccessResponse, Response } from '../../../common/types/api';

test('success response', () => {
  const response = {
    status: 'success',
    data: 'hello, world',
  } satisfies Response;

  expectTypeOf(response).toExtend<SuccessResponse>();
  expectTypeOf(response).not.toExtend<ErrorResponse>();
  expectTypeOf(response).not.toHaveProperty('error');
  expectTypeOf(response).not.toHaveProperty('errorType');
});

test('error response', () => {
  const response = {
    status: 'error',
    error: 'oops, something went wrong',
    errorType: 'InternalError',
  } satisfies Response;

  expectTypeOf(response).toExtend<ErrorResponse>();
  expectTypeOf(response).not.toExtend<SuccessResponse>();
  expectTypeOf(response).not.toHaveProperty('data');
});
