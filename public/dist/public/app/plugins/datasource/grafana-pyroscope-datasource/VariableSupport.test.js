import { __awaiter } from "tslib";
import { lastValueFrom } from 'rxjs';
import { CoreApp, getDefaultTimeRange } from '@grafana/data';
import { VariableSupport } from './VariableSupport';
describe('VariableSupport', () => {
    it('should query profiles', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const mock = getDataApiMock();
            const vs = new VariableSupport(mock);
            const resp = yield lastValueFrom(vs.query(getDefaultRequest()));
            expect(resp.data).toEqual([
                { text: 'profile type 1', value: 'profile:type:1' },
                { text: 'profile type 2', value: 'profile:type:2' },
                { text: 'profile type 3', value: 'profile:type:3' },
            ]);
        });
    });
    it('should query labels', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const mock = getDataApiMock();
            const vs = new VariableSupport(mock);
            const resp = yield lastValueFrom(vs.query(getDefaultRequest({ type: 'label', profileTypeId: 'profile:type:3', refId: 'A' })));
            expect(resp.data).toEqual([{ text: 'foo' }, { text: 'bar' }, { text: 'baz' }]);
            expect(mock.getLabelNames).toBeCalledWith('profile:type:3{}', expect.any(Number), expect.any(Number));
        });
    });
    it('should query label values', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const mock = getDataApiMock();
            const vs = new VariableSupport(mock);
            const resp = yield lastValueFrom(vs.query(getDefaultRequest({ type: 'labelValue', labelName: 'foo', profileTypeId: 'profile:type:3', refId: 'A' })));
            expect(resp.data).toEqual([{ text: 'val1' }, { text: 'val2' }, { text: 'val3' }]);
            expect(mock.getLabelValues).toBeCalledWith('profile:type:3{}', 'foo', expect.any(Number), expect.any(Number));
        });
    });
});
function getDefaultRequest(query = { type: 'profileType', refId: 'A' }) {
    return {
        targets: [query],
        interval: '1s',
        intervalMs: 1000,
        range: getDefaultTimeRange(),
        scopedVars: {},
        timezone: 'utc',
        app: CoreApp.Unknown,
        requestId: '1',
        startTime: 0,
    };
}
function getDataApiMock() {
    const profiles = [
        { id: 'profile:type:1', label: 'profile type 1' },
        { id: 'profile:type:2', label: 'profile type 2' },
        { id: 'profile:type:3', label: 'profile type 3' },
    ];
    const getProfileTypes = jest.fn().mockResolvedValueOnce(profiles);
    const getLabelValues = jest.fn().mockResolvedValueOnce(['val1', 'val2', 'val3']);
    const getLabelNames = jest.fn().mockResolvedValueOnce(['foo', 'bar', 'baz']);
    return {
        getProfileTypes,
        getLabelNames,
        getLabelValues,
    };
}
//# sourceMappingURL=VariableSupport.test.js.map