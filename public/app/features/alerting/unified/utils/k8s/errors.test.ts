import {
  type ApiMachineryError,
  type ApiMachineryErrorResponse,
  ERROR_ROUTES_MATCHER_CONFLICT,
  getErrorMessageFromApiMachineryErrorResponse,
} from './errors';

function buildApiMachineryError(
  data: Partial<ApiMachineryError> & Pick<ApiMachineryError, 'message'>
): ApiMachineryErrorResponse {
  return {
    status: 400,
    config: { url: '' },
    data: {
      kind: 'Status',
      apiVersion: 'v1',
      metadata: {},
      status: 'Failure',
      reason: 'BadRequest',
      code: 400,
      ...data,
    },
  };
}

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

describe('getErrorMessageFromApiMachineryErrorResponse with no known code', () => {
  it('appends field-prefixed cause messages to the base message', () => {
    const error = buildApiMachineryError({
      message: 'receiver is invalid',
      details: {
        uid: '',
        causes: [
          { field: 'spec.integrations[0].settings.url', message: 'URL must be valid' },
          { field: 'spec.integrations[0].settings.token', message: 'token is required' },
        ],
      },
    });

    const result = getErrorMessageFromApiMachineryErrorResponse(error);
    expect(result).toContain('receiver is invalid');
    expect(result).toContain('spec.integrations[0].settings.url: URL must be valid');
    expect(result).toContain('spec.integrations[0].settings.token: token is required');
  });

  it('skips causes with missing message and never emits the literal "undefined"', () => {
    const error = buildApiMachineryError({
      message: 'receiver is invalid',
      details: {
        uid: '',
        causes: [{ field: 'spec.integrations[0]' }, { field: 'spec.integrations[1]', message: 'real reason' }],
      },
    });

    const result = getErrorMessageFromApiMachineryErrorResponse(error);
    expect(result).not.toContain('undefined');
    expect(result).toContain('real reason');
  });

  it('returns the bare base message when causes is an empty array', () => {
    const error = buildApiMachineryError({
      message: 'receiver is invalid',
      details: { uid: '', causes: [] },
    });

    expect(getErrorMessageFromApiMachineryErrorResponse(error)).toBe('receiver is invalid');
  });

  it('returns the bare base message when details is omitted', () => {
    const error = buildApiMachineryError({ message: 'oops' });

    expect(getErrorMessageFromApiMachineryErrorResponse(error)).toBe('oops');
  });

  it('emits a cause without a field prefix when only message is present', () => {
    const error = buildApiMachineryError({
      message: 'receiver is invalid',
      details: { uid: '', causes: [{ message: 'standalone reason' }] },
    });

    expect(getErrorMessageFromApiMachineryErrorResponse(error)).toBe('receiver is invalid: standalone reason');
  });
});
