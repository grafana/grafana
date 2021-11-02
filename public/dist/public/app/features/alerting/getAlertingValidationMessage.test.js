import { __awaiter, __generator } from "tslib";
import { getAlertingValidationMessage } from './getAlertingValidationMessage';
describe('getAlertingValidationMessage', function () {
    describe('when called with some targets containing template variables', function () {
        it('then it should return false', function () { return __awaiter(void 0, void 0, void 0, function () {
            var call, datasource, getMock, datasourceSrv, targets, transformations, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        call = 0;
                        datasource = {
                            meta: { alerting: true },
                            targetContainsTemplate: function () {
                                if (call === 0) {
                                    call++;
                                    return true;
                                }
                                return false;
                            },
                            name: 'some name',
                            uid: 'some uid',
                        };
                        getMock = jest.fn().mockResolvedValue(datasource);
                        datasourceSrv = {
                            get: function (ref) {
                                return getMock(ref.uid);
                            },
                            getList: function () {
                                return [];
                            },
                            getInstanceSettings: (function () { }),
                        };
                        targets = [
                            { refId: 'A', query: '@hostname:$hostname' },
                            { refId: 'B', query: '@instance:instance' },
                        ];
                        transformations = [];
                        return [4 /*yield*/, getAlertingValidationMessage(transformations, targets, datasourceSrv, {
                                uid: datasource.uid,
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result).toBe('');
                        expect(getMock).toHaveBeenCalledTimes(2);
                        expect(getMock).toHaveBeenCalledWith(datasource.uid);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when called with some targets using a datasource that does not support alerting', function () {
        it('then it should return false', function () { return __awaiter(void 0, void 0, void 0, function () {
            var alertingDatasource, datasource, datasourceSrv, targets, transformations, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        alertingDatasource = {
                            meta: { alerting: true },
                            targetContainsTemplate: function () { return false; },
                            name: 'alertingDatasource',
                        };
                        datasource = {
                            meta: { alerting: false },
                            targetContainsTemplate: function () { return false; },
                            name: 'datasource',
                        };
                        datasourceSrv = {
                            get: function (name) {
                                if (name === datasource.name) {
                                    return Promise.resolve(datasource);
                                }
                                return Promise.resolve(alertingDatasource);
                            },
                            getInstanceSettings: (function () { }),
                            getList: function () {
                                return [];
                            },
                        };
                        targets = [
                            { refId: 'A', query: 'some query', datasource: 'alertingDatasource' },
                            { refId: 'B', query: 'some query', datasource: 'datasource' },
                        ];
                        transformations = [];
                        return [4 /*yield*/, getAlertingValidationMessage(transformations, targets, datasourceSrv, {
                                uid: datasource.name,
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result).toBe('');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when called with all targets containing template variables', function () {
        it('then it should return false', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, getMock, datasourceSrv, targets, transformations, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = {
                            meta: { alerting: true },
                            targetContainsTemplate: function () { return true; },
                            name: 'some name',
                        };
                        getMock = jest.fn().mockResolvedValue(datasource);
                        datasourceSrv = {
                            get: function (ref) {
                                return getMock(ref.uid);
                            },
                            getInstanceSettings: (function () { }),
                            getList: function () {
                                return [];
                            },
                        };
                        targets = [
                            { refId: 'A', query: '@hostname:$hostname' },
                            { refId: 'B', query: '@instance:$instance' },
                        ];
                        transformations = [];
                        return [4 /*yield*/, getAlertingValidationMessage(transformations, targets, datasourceSrv, {
                                uid: datasource.name,
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result).toBe('Template variables are not supported in alert queries');
                        expect(getMock).toHaveBeenCalledTimes(2);
                        expect(getMock).toHaveBeenCalledWith(datasource.name);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when called with all targets using a datasource that does not support alerting', function () {
        it('then it should return false', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, getMock, datasourceSrv, targets, transformations, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = {
                            meta: { alerting: false },
                            targetContainsTemplate: function () { return false; },
                            name: 'some name',
                            uid: 'theid',
                        };
                        getMock = jest.fn().mockResolvedValue(datasource);
                        datasourceSrv = {
                            get: function (ref) {
                                return getMock(ref.uid);
                            },
                            getInstanceSettings: (function () { }),
                            getList: function () {
                                return [];
                            },
                        };
                        targets = [
                            { refId: 'A', query: '@hostname:hostname' },
                            { refId: 'B', query: '@instance:instance' },
                        ];
                        transformations = [];
                        return [4 /*yield*/, getAlertingValidationMessage(transformations, targets, datasourceSrv, {
                                uid: datasource.uid,
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result).toBe('The datasource does not support alerting queries');
                        expect(getMock).toHaveBeenCalledTimes(2);
                        expect(getMock).toHaveBeenCalledWith(datasource.uid);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when called with transformations', function () {
        it('then it should return false', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, getMock, datasourceSrv, targets, transformations, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = {
                            meta: { alerting: true },
                            targetContainsTemplate: function () { return false; },
                            name: 'some name',
                        };
                        getMock = jest.fn().mockResolvedValue(datasource);
                        datasourceSrv = {
                            get: function (ref) {
                                return getMock(ref.uid);
                            },
                            getInstanceSettings: (function () { }),
                            getList: function () {
                                return [];
                            },
                        };
                        targets = [
                            { refId: 'A', query: '@hostname:hostname' },
                            { refId: 'B', query: '@instance:instance' },
                        ];
                        transformations = [{ id: 'A', options: null }];
                        return [4 /*yield*/, getAlertingValidationMessage(transformations, targets, datasourceSrv, {
                                uid: datasource.uid,
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result).toBe('Transformations are not supported in alert queries');
                        expect(getMock).toHaveBeenCalledTimes(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=getAlertingValidationMessage.test.js.map