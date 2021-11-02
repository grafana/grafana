import { __awaiter, __generator } from "tslib";
import { lastUsedDatasourceKeyForOrgId } from '../../../core/utils/explore';
var dataSourceMock = {
    get: jest.fn(),
};
jest.mock('app/features/plugins/datasource_srv', function () { return ({
    getDatasourceSrv: jest.fn(function () { return dataSourceMock; }),
}); });
var storeMock = {
    getObject: jest.fn().mockReturnValue([]),
    set: jest.fn(),
};
jest.mock('app/core/store', function () { return storeMock; });
import { loadAndInitDatasource } from './utils';
var DEFAULT_DATASOURCE = { uid: 'abc123', name: 'Default' };
var TEST_DATASOURCE = { uid: 'def789', name: 'Test' };
describe('loadAndInitDatasource', function () {
    beforeEach(function () {
        jest.clearAllMocks();
    });
    it('falls back to default datasource if the provided one was not found', function () { return __awaiter(void 0, void 0, void 0, function () {
        var instance;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    dataSourceMock.get.mockRejectedValueOnce(new Error('Datasource not found'));
                    dataSourceMock.get.mockResolvedValue(DEFAULT_DATASOURCE);
                    return [4 /*yield*/, loadAndInitDatasource(1, 'Unknown')];
                case 1:
                    instance = (_a.sent()).instance;
                    expect(dataSourceMock.get).toBeCalledTimes(2);
                    expect(dataSourceMock.get).toBeCalledWith('Unknown');
                    expect(dataSourceMock.get).toBeCalledWith();
                    expect(instance).toMatchObject(DEFAULT_DATASOURCE);
                    expect(storeMock.set).toBeCalledWith(lastUsedDatasourceKeyForOrgId(1), DEFAULT_DATASOURCE.uid);
                    return [2 /*return*/];
            }
        });
    }); });
    it('saves last loaded data source uid', function () { return __awaiter(void 0, void 0, void 0, function () {
        var instance;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    dataSourceMock.get.mockResolvedValue(TEST_DATASOURCE);
                    return [4 /*yield*/, loadAndInitDatasource(1, 'Test')];
                case 1:
                    instance = (_a.sent()).instance;
                    expect(dataSourceMock.get).toBeCalledTimes(1);
                    expect(dataSourceMock.get).toBeCalledWith('Test');
                    expect(instance).toMatchObject(TEST_DATASOURCE);
                    expect(storeMock.set).toBeCalledWith(lastUsedDatasourceKeyForOrgId(1), TEST_DATASOURCE.uid);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=utils.test.js.map