import { __awaiter } from "tslib";
import { PluginType, toUtc } from '@grafana/data';
import { TempoDatasource } from './datasource';
const rawRange = {
    from: toUtc('2018-04-25 10:00'),
    to: toUtc('2018-04-25 11:00'),
};
const defaultTimeSrvMock = {
    timeRange: jest.fn().mockReturnValue({
        from: rawRange.from,
        to: rawRange.to,
        raw: rawRange,
    }),
};
const defaultTemplateSrvMock = {
    replace: (input) => input,
};
export function createTempoDatasource(templateSrvMock = defaultTemplateSrvMock, settings = {}, timeSrvStub = defaultTimeSrvMock) {
    const customSettings = Object.assign({ url: 'myloggingurl', id: 0, uid: '', type: '', name: '', meta: {
            id: 'id',
            name: 'name',
            type: PluginType.datasource,
            module: '',
            baseUrl: '',
            info: {
                author: {
                    name: 'Test',
                },
                description: '',
                links: [],
                logos: {
                    large: '',
                    small: '',
                },
                screenshots: [],
                updated: '',
                version: '',
            },
        }, readOnly: false, jsonData: {}, access: 'direct' }, settings);
    // @ts-expect-error
    return new TempoDatasource(customSettings, templateSrvMock, timeSrvStub);
}
export function createMetadataRequest(labelsAndValues) {
    return () => __awaiter(this, void 0, void 0, function* () { return labelsAndValues; });
}
//# sourceMappingURL=mocks.js.map