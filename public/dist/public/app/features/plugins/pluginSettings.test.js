import { __awaiter } from "tslib";
import { getBackendSrv } from '@grafana/runtime';
import { getPluginSettings, clearPluginSettingsCache } from './pluginSettings';
jest.mock('@grafana/runtime', () => ({
    getBackendSrv: jest.fn().mockReturnValue({
        get: jest.fn(),
    }),
}));
describe('PluginSettings', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearPluginSettingsCache();
    });
    it('should fetch settings when cache is empty', () => __awaiter(void 0, void 0, void 0, function* () {
        // arrange
        const testPluginResponse = {
            name: 'TestPlugin',
            type: 'datasource',
            id: 'test-plugin',
            enabled: true,
        };
        getBackendSrv().get = jest.fn().mockResolvedValue(testPluginResponse);
        const getRequestSpy = jest.spyOn(getBackendSrv(), 'get');
        // act
        const response = yield getPluginSettings('test');
        // assert
        expect(response).toEqual(testPluginResponse);
        expect(getRequestSpy).toHaveBeenCalledTimes(1);
        expect(getRequestSpy).toHaveBeenCalledWith('/api/plugins/test/settings', undefined, undefined, undefined);
    }));
    it('should fetch settings from cache when it has a hit', () => __awaiter(void 0, void 0, void 0, function* () {
        // arrange
        const testPluginResponse = {
            name: 'TestPlugin',
            type: 'datasource',
            id: 'test-plugin',
            enabled: true,
        };
        getBackendSrv().get = jest.fn().mockResolvedValue(testPluginResponse);
        const getRequestSpy = jest.spyOn(getBackendSrv(), 'get');
        // act
        const response1 = yield getPluginSettings('test');
        const response2 = yield getPluginSettings('test');
        // assert
        expect(response1).toEqual(testPluginResponse);
        expect(response2).toEqual(testPluginResponse);
        expect(getRequestSpy).toHaveBeenCalledTimes(1);
    }));
    it('should refetch from backend when cache is cleared', () => __awaiter(void 0, void 0, void 0, function* () {
        // arrange
        const testPluginResponse = {
            name: 'TestPlugin',
            type: 'datasource',
            id: 'test-plugin',
            enabled: true,
        };
        getBackendSrv().get = jest.fn().mockResolvedValue(testPluginResponse);
        const getRequestSpy = jest.spyOn(getBackendSrv(), 'get');
        // act
        const response1 = yield getPluginSettings('test');
        yield clearPluginSettingsCache('test');
        const response2 = yield getPluginSettings('test');
        // assert
        expect(response1).toEqual(testPluginResponse);
        expect(response2).toEqual(testPluginResponse);
        expect(getRequestSpy).toHaveBeenCalledTimes(2);
    }));
    it('should fetch from cache when it is cleared for another plugin setting', () => __awaiter(void 0, void 0, void 0, function* () {
        // arrange
        const testPluginResponse = {
            name: 'TestPlugin',
            type: 'datasource',
            id: 'test-plugin',
            enabled: true,
        };
        getBackendSrv().get = jest.fn().mockResolvedValue(testPluginResponse);
        const getRequestSpy = jest.spyOn(getBackendSrv(), 'get');
        // act
        const response1 = yield getPluginSettings('test');
        yield clearPluginSettingsCache('another-test');
        const response2 = yield getPluginSettings('test');
        // assert
        expect(response1).toEqual(testPluginResponse);
        expect(response2).toEqual(testPluginResponse);
        expect(getRequestSpy).toHaveBeenCalledTimes(1);
    }));
    it('should clear all cache when no plugin id is provided to the clear function', () => __awaiter(void 0, void 0, void 0, function* () {
        // arrange
        const testPluginResponse = {
            name: 'TestPlugin',
            type: 'datasource',
            id: 'test-plugin',
            enabled: true,
        };
        getBackendSrv().get = jest.fn().mockResolvedValue(testPluginResponse);
        const getRequestSpy = jest.spyOn(getBackendSrv(), 'get');
        // act
        const response1 = yield getPluginSettings('test');
        yield clearPluginSettingsCache();
        const response2 = yield getPluginSettings('test');
        // assert
        expect(response1).toEqual(testPluginResponse);
        expect(response2).toEqual(testPluginResponse);
        expect(getRequestSpy).toHaveBeenCalledTimes(2);
    }));
});
//# sourceMappingURL=pluginSettings.test.js.map