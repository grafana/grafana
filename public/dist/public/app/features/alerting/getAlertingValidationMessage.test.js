import { __awaiter } from "tslib";
import { getAlertingValidationMessage } from './getAlertingValidationMessage';
describe('getAlertingValidationMessage', () => {
    describe('when called with some targets containing template variables', () => {
        it('then it should return false', () => __awaiter(void 0, void 0, void 0, function* () {
            let call = 0;
            const datasource = {
                meta: { alerting: true },
                targetContainsTemplate: () => {
                    if (call === 0) {
                        call++;
                        return true;
                    }
                    return false;
                },
                name: 'some name',
                uid: 'some uid',
            };
            const getMock = jest.fn().mockResolvedValue(datasource);
            const datasourceSrv = {
                get: (ref) => {
                    return getMock(ref.uid);
                },
                getList() {
                    return [];
                },
                getInstanceSettings: jest.fn(),
                reload: jest.fn(),
            };
            const targets = [
                { refId: 'A', query: '@hostname:$hostname' },
                { refId: 'B', query: '@instance:instance' },
            ];
            const transformations = [];
            const result = yield getAlertingValidationMessage(transformations, targets, datasourceSrv, {
                uid: datasource.uid,
            });
            expect(result).toBe('');
            expect(getMock).toHaveBeenCalledTimes(2);
            expect(getMock).toHaveBeenCalledWith(datasource.uid);
        }));
    });
    describe('when called with some targets using a datasource that does not support alerting', () => {
        it('then it should return false', () => __awaiter(void 0, void 0, void 0, function* () {
            const alertingDatasource = {
                meta: { alerting: true },
                targetContainsTemplate: () => false,
                name: 'alertingDatasource',
            };
            const datasource = {
                meta: { alerting: false },
                targetContainsTemplate: () => false,
                name: 'datasource',
            };
            const datasourceSrv = {
                get: (name) => {
                    if (name === datasource.name) {
                        return Promise.resolve(datasource);
                    }
                    return Promise.resolve(alertingDatasource);
                },
                getInstanceSettings: jest.fn(),
                getList() {
                    return [];
                },
                reload: jest.fn(),
            };
            const targets = [
                { refId: 'A', datasource: { type: 'alertingDatasource' } },
                { refId: 'B', datasource: { type: 'datasource' } },
            ];
            const transformations = [];
            const result = yield getAlertingValidationMessage(transformations, targets, datasourceSrv, {
                uid: datasource.name,
            });
            expect(result).toBe('');
        }));
    });
    describe('when called with all targets containing template variables', () => {
        it('then it should return false', () => __awaiter(void 0, void 0, void 0, function* () {
            const datasource = {
                meta: { alerting: true },
                targetContainsTemplate: () => true,
                name: 'some name',
            };
            const getMock = jest.fn().mockResolvedValue(datasource);
            const datasourceSrv = {
                get: (ref) => {
                    return getMock(ref.uid);
                },
                getInstanceSettings: jest.fn(),
                getList() {
                    return [];
                },
                reload: jest.fn(),
            };
            const targets = [
                { refId: 'A', query: '@hostname:$hostname' },
                { refId: 'B', query: '@instance:$instance' },
            ];
            const transformations = [];
            const result = yield getAlertingValidationMessage(transformations, targets, datasourceSrv, {
                uid: datasource.name,
            });
            expect(result).toBe('Template variables are not supported in alert queries');
            expect(getMock).toHaveBeenCalledTimes(2);
            expect(getMock).toHaveBeenCalledWith(datasource.name);
        }));
    });
    describe('when called with all targets using a datasource that does not support alerting', () => {
        it('then it should return false', () => __awaiter(void 0, void 0, void 0, function* () {
            const datasource = {
                meta: { alerting: false },
                targetContainsTemplate: () => false,
                name: 'some name',
                uid: 'theid',
            };
            const getMock = jest.fn().mockResolvedValue(datasource);
            const datasourceSrv = {
                get: (ref) => {
                    return getMock(ref.uid);
                },
                getInstanceSettings: jest.fn(),
                getList() {
                    return [];
                },
                reload: jest.fn(),
            };
            const targets = [
                { refId: 'A', query: '@hostname:hostname' },
                { refId: 'B', query: '@instance:instance' },
            ];
            const transformations = [];
            const result = yield getAlertingValidationMessage(transformations, targets, datasourceSrv, {
                uid: datasource.uid,
            });
            expect(result).toBe('The datasource does not support alerting queries');
            expect(getMock).toHaveBeenCalledTimes(2);
            expect(getMock).toHaveBeenCalledWith(datasource.uid);
        }));
    });
    describe('when called with transformations', () => {
        it('then it should return false', () => __awaiter(void 0, void 0, void 0, function* () {
            const datasource = {
                meta: { alerting: true },
                targetContainsTemplate: () => false,
                name: 'some name',
            };
            const getMock = jest.fn().mockResolvedValue(datasource);
            const datasourceSrv = {
                get: (ref) => {
                    return getMock(ref.uid);
                },
                getInstanceSettings: jest.fn(),
                getList() {
                    return [];
                },
                reload: jest.fn(),
            };
            const targets = [
                { refId: 'A', query: '@hostname:hostname' },
                { refId: 'B', query: '@instance:instance' },
            ];
            const transformations = [{ id: 'A', options: null }];
            const result = yield getAlertingValidationMessage(transformations, targets, datasourceSrv, {
                uid: datasource.uid,
            });
            expect(result).toBe('Transformations are not supported in alert queries');
            expect(getMock).toHaveBeenCalledTimes(0);
        }));
    });
});
//# sourceMappingURL=getAlertingValidationMessage.test.js.map