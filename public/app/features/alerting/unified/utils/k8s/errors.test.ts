import {
  ApiMachineryErrorResponse,
  ERROR_ROUTES_MATCHER_CONFLICT,
  getErrorMessageFromApiMachineryErrorResponse,
} from './errors';

describe('getErrorMessageFromCode', () => {
  it(`should handle ${ERROR_ROUTES_MATCHER_CONFLICT}`, () => {
    const error: ApiMachineryErrorResponse = {
      status: 400,
      config: { url: '' },
      data: {
        kind: 'Status',
        apiVersion: 'v1',
        metadata: {},
        status: 'Failure',
        message: 'this is ignored',
        reason: 'BadRequest',
        details: {
          uid: 'alerting.notifications.routes.conflictingMatchers',
          causes: [
            {
              message: '"[foo=\\"bar\\" baz=\\"qux\\"]"',
              field: 'Matchers',
            },
            {
              message: '"[foo2=\\"bar2\\" baz2=\\"qux2\\"]"',
              field: 'Matchers',
            },
          ],
        },
        code: 400,
      },
    };

    expect(getErrorMessageFromApiMachineryErrorResponse(error)).toBe(
      'Cannot add or update route: matchers conflict with an external routing tree if we merged matchers \"[foo=\\\"bar\\\" baz=\\\"qux\\\"]\", \"[foo2=\\\"bar2\\\" baz2=\\\"qux2\\\"]\". This would make the route unreachable.'
    );

    delete error.data.details?.causes;
    expect(getErrorMessageFromApiMachineryErrorResponse(error)).toBe(
      'Cannot add or update route: matchers conflict with an external routing tree if we merged matchers <unknown matchers>. This would make the route unreachable.'
    );
  });
});
