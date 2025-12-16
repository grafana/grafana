import { DataQueryResponse } from '@grafana/data';

import { isMaxBytesErrorResponse, isTimeoutErrorResponse } from './logsVolumeResponse';

const errorA =
  'Get "http://localhost:3100/loki/api/v1/query_range?direction=backward&end=1680001200000000000&limit=1000&query=sum+by+%28level%29+%28count_over_time%28%7Bcontainer_name%3D%22docker-compose-app-1%22%7D%5B1h%5D%29%29&start=1679914800000000000&step=3600000ms": net/http: request canceled (Client.Timeout exceeded while awaiting headers)';
const errorB = '{"status":"error","errorType":"timeout","error":"context deadline exceeded"}';

describe('isTimeoutErrorResponse', () => {
  test.each([errorA, errorB])(
    'identifies timeout errors in the error.message attribute when the message is `%s`',
    (timeoutError: string) => {
      const response: DataQueryResponse = {
        data: [],
        error: {
          message: timeoutError,
        },
      };
      expect(isTimeoutErrorResponse(response)).toBe(true);
      expect(isMaxBytesErrorResponse(response)).toBe(false);
    }
  );
  test.each([errorA, errorB])(
    'identifies timeout errors in the errors.message attribute when the message is `%s`',
    (timeoutError: string) => {
      const response: DataQueryResponse = {
        data: [],
        errors: [
          {
            message: 'Something else',
          },
          {
            message: timeoutError,
          },
        ],
      };
      expect(isTimeoutErrorResponse(response)).toBe(true);
      expect(isMaxBytesErrorResponse(response)).toBe(false);
    }
  );
  test.each([errorA, errorB])(
    'identifies timeout errors in the errors.data.message attribute when the message is `%s`',
    (timeoutError: string) => {
      const response: DataQueryResponse = {
        data: [],
        errors: [
          {
            data: {
              message: 'Something else',
            },
          },
          {
            data: {
              message: timeoutError,
            },
          },
        ],
      };
      expect(isTimeoutErrorResponse(response)).toBe(true);
      expect(isMaxBytesErrorResponse(response)).toBe(false);
    }
  );
  test('does not report false positives', () => {
    const response: DataQueryResponse = {
      data: [],
    };
    expect(isTimeoutErrorResponse(response)).toBe(false);
    expect(isMaxBytesErrorResponse(response)).toBe(false);
  });
});
describe('isMaxBytesErrorResponse', () => {
  const error = `the query would read too many bytes (query: 49 MiB, limit: 1.0 MiB); consider adding more specific stream selectors or reduce the time range of the query`;

  it('identifies timeout errors in the error.message attribute when the message is `%s`', () => {
    const response: DataQueryResponse = {
      data: [],
      error: {
        message: error,
      },
    };
    expect(isTimeoutErrorResponse(response)).toBe(false);
    expect(isMaxBytesErrorResponse(response)).toBe(true);
  });

  it('identifies timeout errors in the errors.message attribute when the message is `%s`', () => {
    const response: DataQueryResponse = {
      data: [],
      errors: [
        {
          message: 'Something else',
        },
        {
          message: error,
        },
      ],
    };
    expect(isTimeoutErrorResponse(response)).toBe(false);
    expect(isMaxBytesErrorResponse(response)).toBe(true);
  });
  it('identifies timeout errors in the errors.data.message attribute when the message is `%s`', () => {
    const response: DataQueryResponse = {
      data: [],
      errors: [
        {
          data: {
            message: 'Something else',
          },
        },
        {
          data: {
            message: error,
          },
        },
      ],
    };
    expect(isTimeoutErrorResponse(response)).toBe(false);
    expect(isMaxBytesErrorResponse(response)).toBe(true);
  });
  test('does not report false positives', () => {
    const response: DataQueryResponse = {
      data: [],
      errors: [
        {
          status: 500,
          data: {
            message: 'Servr error',
          },
        },
      ],
    };
    expect(isTimeoutErrorResponse(response)).toBe(false);
    expect(isMaxBytesErrorResponse(response)).toBe(false);
  });
});
