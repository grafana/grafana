import { __awaiter } from "tslib";
/* eslint-disable @typescript-eslint/consistent-type-assertions,@typescript-eslint/no-explicit-any */
import axios from 'axios';
import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/app_events';
import { ApiErrorCode } from '../core';
export class ApiRequest {
    constructor(params) {
        this.axiosInstance = axios.create(Object.assign({}, params));
    }
    get(path, disableNotifications = false, query) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.axiosInstance
                .get(path, query)
                .then((response) => response.data)
                .catch((e) => {
                if (!disableNotifications) {
                    appEvents.emit(AppEvents.alertError, [e.message]);
                }
                throw e;
            });
        });
    }
    post(path, body, disableNotifications = false, cancelToken) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.axiosInstance
                .post(path, body, { cancelToken })
                .then((response) => response.data)
                .catch((e) => {
                var _a, _b;
                if (!disableNotifications && !axios.isCancel(e)) {
                    appEvents.emit(AppEvents.alertError, [(_b = (_a = e.response.data) === null || _a === void 0 ? void 0 : _a.message) !== null && _b !== void 0 ? _b : 'Unknown error']);
                }
                throw e;
            });
        });
    }
    delete(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.axiosInstance
                .delete(path)
                .then((response) => response.data)
                .catch((e) => {
                // Notify.error(e.message);
                throw e;
            });
        });
    }
    patch(path, body) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.axiosInstance
                .patch(path, body)
                .then((response) => response.data)
                .catch((e) => {
                // Notify.error(e.message);
                throw e;
            });
        });
    }
    put(path, body) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.axiosInstance
                .put(path, body)
                .then((response) => response.data)
                .catch((e) => {
                // Notify.error(e.message);
                throw e;
            });
        });
    }
}
export const api = new ApiRequest({});
export const apiQAN = new ApiRequest({ baseURL: '/v0/qan' });
export const apiManagement = new ApiRequest({ baseURL: '/v1/management' });
export const apiInventory = new ApiRequest({ baseURL: '/v1/inventory' });
export const apiSettings = new ApiRequest({ baseURL: '/v1/Settings' });
export const isApiCancelError = (e) => axios.isCancel(e);
export const translateApiError = (error) => {
    const map = {
        [ApiErrorCode.ERROR_CODE_INVALID_XTRABACKUP]: {
            message: 'Different versions of xtrabackup and xbcloud.',
            link: '',
        },
        [ApiErrorCode.ERROR_CODE_XTRABACKUP_NOT_INSTALLED]: {
            message: 'Xtrabackup is not installed.',
            link: 'https://per.co.na/install_pxb',
        },
        [ApiErrorCode.ERROR_CODE_INCOMPATIBLE_XTRABACKUP]: {
            message: 'Xtrabackup version is not compatible.',
            link: 'https://per.co.na/install_pxb',
        },
        [ApiErrorCode.ERROR_CODE_INCOMPATIBLE_TARGET_MYSQL]: {
            message: 'Target MySQL version is not compatible.',
            link: 'https://per.co.na/install_pxb',
        },
    };
    const translatedError = map[error];
    return translatedError;
};
export const apiErrorParser = (e) => {
    var _a;
    const errorData = (_a = e.response) === null || _a === void 0 ? void 0 : _a.data;
    let result = [];
    if (errorData) {
        const { details = [] } = errorData;
        result = details.reduce((acc, current) => {
            const translatedError = translateApiError(current.code);
            return translatedError ? [...acc, translatedError] : acc;
        }, []);
    }
    return result;
};
export const getApiFilterParams = (params) => {
    const resultParams = { filter_params: {} };
    params.forEach((param) => {
        for (const [key, { intValues = [], longValues = [], stringValues = [] }] of Object.entries(param)) {
            resultParams.filter_params[key] = {
                int_values: { values: intValues },
                long_values: { values: longValues },
                string_values: { values: stringValues },
            };
        }
    });
    return resultParams;
};
//# sourceMappingURL=api.js.map