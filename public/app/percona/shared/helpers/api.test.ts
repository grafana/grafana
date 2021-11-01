import { AxiosError, AxiosInstance } from 'axios';
import { ApiErrorCode } from '../core';
import { apiErrorParser, ApiRequest, AxiosInstanceEx, translateApiError } from './api';

declare module './api' {
  export interface AxiosInstanceEx extends AxiosInstance {
    get: jest.Mock<any, any>;
    post: jest.Mock<any, any>;
    patch: jest.Mock<any, any>;
    delete: jest.Mock<any, any>;
  }
}

// Notice how `create` was not being mocked here...
const mockNoop = jest.fn();

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    default: mockNoop,
    get: mockNoop,
    post: mockNoop,
    put: mockNoop,
    delete: mockNoop,
    patch: mockNoop,
  })),
  isCancel: jest.fn(),
}));

jest.mock('app/core/app_events');

describe('GET::', () => {
  it('should return data', async () => {
    const api = new ApiRequest({});

    (api.axiosInstance as AxiosInstanceEx).get.mockResolvedValueOnce({ data: 'some data' });
    const result = await api.get('/test/path', { params: { key: 'value' } });

    expect(result).toEqual('some data');
  });
});

describe('POST::', () => {
  it('should return response data', async () => {
    const api = new ApiRequest({});

    (api.axiosInstance as AxiosInstanceEx).post.mockResolvedValueOnce({ data: 'some data' });
    const result = await api.post('/test/path', { key: 'value' });

    expect(result).toEqual('some data');
  });

  it('should display an error message on a network error', async () => {
    const response = { response: { data: { message: 'Error' } } };
    const api = new ApiRequest({});

    (api.axiosInstance as AxiosInstanceEx).post.mockImplementationOnce(() => Promise.reject(response));
    const result = api.post('/test/path', { key: 'value' });

    await expect(result).rejects.toEqual(response);
  });

  it('should display no error message if messages are disabled', async () => {
    const api = new ApiRequest({});
    const response = { message: 'Error' };

    (api.axiosInstance as AxiosInstanceEx).post.mockImplementationOnce(() => Promise.reject(response));
    const result = api.post('/test/path', { key: 'value' }, true);

    await expect(result).rejects.toEqual(response);
  });
});

describe('PATCH::', () => {
  it('should return response data', async () => {
    const api = new ApiRequest({});

    (api.axiosInstance as AxiosInstanceEx).patch.mockResolvedValueOnce({ data: 'some data' });
    const result = await api.patch('/test/path', { key: 'value' });

    await expect(result).toEqual('some data');
  });
});

describe('DELETE::', () => {
  it('should return response data', async () => {
    const api = new ApiRequest({});

    (api.axiosInstance as AxiosInstanceEx).delete.mockResolvedValueOnce({ data: 'some data' });
    const result = await api.delete('/test/path');

    await expect(result).toEqual('some data');
  });
});

describe('translateApiError', () => {
  it('should return undefined for non-mapped errors', () => {
    expect(translateApiError('foo' as ApiErrorCode)).toBeUndefined();
  });

  it('should return mapped mapped string for known errors', () => {
    expect(translateApiError(ApiErrorCode.ERROR_CODE_INVALID_XTRABACKUP)).not.toBeUndefined();
  });
});

describe('apiErrorParser', () => {
  it('should return empty array if no response available', () => {
    expect(apiErrorParser({} as AxiosError)).toHaveLength(0);
  });

  it('should return empty array if no response data available', () => {
    expect(apiErrorParser({ response: {} } as AxiosError)).toHaveLength(0);
  });

  it('should return empty array if no error details available', () => {
    expect(apiErrorParser({ response: { data: {} } } as AxiosError)).toHaveLength(0);
  });

  it('should return empty array if no error details available', () => {
    expect(apiErrorParser({ response: { data: {} } } as AxiosError)).toHaveLength(0);
  });

  it('should return array with translated codes', () => {
    expect(
      apiErrorParser({
        response: { data: { details: [{ code: ApiErrorCode.ERROR_CODE_INCOMPATIBLE_TARGET_MYSQL }] } },
      } as AxiosError)
    ).toHaveLength(1);

    expect(
      apiErrorParser({
        response: {
          data: {
            details: [
              { code: ApiErrorCode.ERROR_CODE_INCOMPATIBLE_TARGET_MYSQL },
              { code: ApiErrorCode.ERROR_CODE_INVALID_XTRABACKUP },
            ],
          },
        },
      } as AxiosError)
    ).toHaveLength(2);
  });
});
