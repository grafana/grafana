import { __awaiter } from "tslib";
import { DataSourceWithBackend } from '@grafana/runtime';
import { updateConfig } from 'app/core/config';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { dashboardHasTemplateVariables, publicDashboardPersisted, generatePublicDashboardUrl, getUnsupportedDashboardDatasources, } from './SharePublicDashboardUtils';
const mockDS = mockDataSource({
    name: 'mock-ds',
    type: 'mock-ds-type',
});
jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => {
    return {
        getDataSourceSrv: () => ({
            get: () => Promise.resolve(new DataSourceWithBackend(Object.assign(Object.assign({}, mockDS), { meta: Object.assign(Object.assign({}, mockDS.meta), { alerting: true, backend: true }) }))),
        }),
    };
});
describe('dashboardHasTemplateVariables', () => {
    it('false', () => {
        let variables = [];
        expect(dashboardHasTemplateVariables(variables)).toBe(false);
    });
    it('true', () => {
        //@ts-ignore
        let variables = ['a'];
        expect(dashboardHasTemplateVariables(variables)).toBe(true);
    });
});
describe('generatePublicDashboardUrl', () => {
    it('uses the grafana config appUrl to generate the url', () => {
        const appUrl = 'http://localhost/';
        const accessToken = 'abcd1234';
        updateConfig({ appUrl });
        let pubdash = { accessToken };
        expect(generatePublicDashboardUrl(pubdash.accessToken)).toEqual(`${appUrl}public-dashboards/${accessToken}`);
    });
});
describe('publicDashboardPersisted', () => {
    it('true', () => {
        let pubdash = { uid: 'abcd1234' };
        expect(publicDashboardPersisted(pubdash)).toBe(true);
    });
    it('false', () => {
        let pubdash = { uid: '' };
        expect(publicDashboardPersisted(pubdash)).toBe(false);
        pubdash = {};
        expect(publicDashboardPersisted(pubdash)).toBe(false);
    });
});
describe('getUnsupportedDashboardDatasources', () => {
    it('itIsSupported', () => __awaiter(void 0, void 0, void 0, function* () {
        const pm = {
            targets: [
                {
                    datasource: { type: 'prometheus' },
                },
                {
                    datasource: { type: '__expr__' },
                },
                {
                    datasource: { type: 'datasource' },
                },
            ],
        };
        const panelArray = [pm];
        const unsupportedDataSources = yield getUnsupportedDashboardDatasources(panelArray);
        expect(unsupportedDataSources).toEqual([]);
    }));
    it('itIsNotSupported', () => __awaiter(void 0, void 0, void 0, function* () {
        const pm = {
            targets: [
                {
                    datasource: { type: 'blah' },
                },
            ],
        };
        const panelArray = [pm];
        const unsupportedDataSources = yield getUnsupportedDashboardDatasources(panelArray);
        expect(unsupportedDataSources).toEqual(['blah']);
    }));
});
//# sourceMappingURL=SharePublicDashboardUtils.test.js.map