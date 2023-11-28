import { __awaiter } from "tslib";
import { ApiErrorCode } from '../core';
import { apiErrorParser, ApiRequest, translateApiError, getApiFilterParams } from './api';
jest.mock('axios', () => ({
    create: jest.fn(() => ({
        default: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        patch: jest.fn(),
    })),
    isCancel: jest.fn(),
}));
jest.mock('app/core/app_events');
describe('GET::', () => {
    it('should return data', () => __awaiter(void 0, void 0, void 0, function* () {
        const api = new ApiRequest({});
        api.axiosInstance.get.mockResolvedValueOnce({ data: 'some data' });
        const result = yield api.get('/test/path', false, { params: { key: 'value' } });
        expect(result).toEqual('some data');
    }));
});
describe('POST::', () => {
    it('should return response data', () => __awaiter(void 0, void 0, void 0, function* () {
        const api = new ApiRequest({});
        api.axiosInstance.post.mockResolvedValueOnce({ data: 'some data' });
        const result = yield api.post('/test/path', { key: 'value' });
        expect(result).toEqual('some data');
    }));
    it('should display an error message on a network error', () => __awaiter(void 0, void 0, void 0, function* () {
        const response = { response: { data: { message: 'Error' } } };
        const api = new ApiRequest({});
        api.axiosInstance.post.mockImplementationOnce(() => Promise.reject(response));
        const result = api.post('/test/path', { key: 'value' });
        yield expect(result).rejects.toEqual(response);
    }));
    it('should display no error message if messages are disabled', () => __awaiter(void 0, void 0, void 0, function* () {
        const api = new ApiRequest({});
        const response = { message: 'Error' };
        api.axiosInstance.post.mockImplementationOnce(() => Promise.reject(response));
        const result = api.post('/test/path', { key: 'value' }, true);
        yield expect(result).rejects.toEqual(response);
    }));
});
describe('PATCH::', () => {
    it('should return response data', () => __awaiter(void 0, void 0, void 0, function* () {
        const api = new ApiRequest({});
        api.axiosInstance.patch.mockResolvedValueOnce({ data: 'some data' });
        const result = yield api.patch('/test/path', { key: 'value' });
        yield expect(result).toEqual('some data');
    }));
});
describe('DELETE::', () => {
    it('should return response data', () => __awaiter(void 0, void 0, void 0, function* () {
        const api = new ApiRequest({});
        api.axiosInstance.delete.mockResolvedValueOnce({ data: 'some data' });
        const result = yield api.delete('/test/path');
        yield expect(result).toEqual('some data');
    }));
});
describe('translateApiError', () => {
    it('should return undefined for non-mapped errors', () => {
        expect(translateApiError('foo')).toBeUndefined();
    });
    it('should return mapped mapped string for known errors', () => {
        expect(translateApiError(ApiErrorCode.ERROR_CODE_INVALID_XTRABACKUP)).not.toBeUndefined();
    });
});
describe('apiErrorParser', () => {
    it('should return empty array if no response available', () => {
        expect(apiErrorParser({})).toHaveLength(0);
    });
    it('should return empty array if no response data available', () => {
        expect(apiErrorParser({ response: {} })).toHaveLength(0);
    });
    it('should return empty array if no error details available', () => {
        expect(apiErrorParser({ response: { data: {} } })).toHaveLength(0);
    });
    it('should return empty array if no error details available', () => {
        expect(apiErrorParser({ response: { data: {} } })).toHaveLength(0);
    });
    it('should return array with translated codes', () => {
        expect(apiErrorParser({
            response: { data: { details: [{ code: ApiErrorCode.ERROR_CODE_INCOMPATIBLE_TARGET_MYSQL }] } },
        })).toHaveLength(1);
        expect(apiErrorParser({
            response: {
                data: {
                    details: [
                        { code: ApiErrorCode.ERROR_CODE_INCOMPATIBLE_TARGET_MYSQL },
                        { code: ApiErrorCode.ERROR_CODE_INVALID_XTRABACKUP },
                    ],
                },
            },
        })).toHaveLength(2);
    });
});
describe('getApiFilterParams', () => {
    it('should return no filter params if no params passed', () => {
        expect(getApiFilterParams([])).toEqual({ filter_params: {} });
    });
    it('should return int values', () => {
        expect(getApiFilterParams([{ category: { intValues: [10, 0] } }])).toEqual({
            filter_params: {
                category: { int_values: { values: [10, 0] }, long_values: { values: [] }, string_values: { values: [] } },
            },
        });
    });
    it('should return mixed values', () => {
        expect(getApiFilterParams([{ category: { intValues: [10, 0], longValues: [1], stringValues: ['', 'foo'] } }])).toEqual({
            filter_params: {
                category: {
                    int_values: { values: [10, 0] },
                    long_values: { values: [1] },
                    string_values: { values: ['', 'foo'] },
                },
            },
        });
    });
});
//# sourceMappingURL=api.test.js.map