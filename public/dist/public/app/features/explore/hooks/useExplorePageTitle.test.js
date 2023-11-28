import { __awaiter } from "tslib";
import { renderHook, waitFor } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';
import { setDataSourceSrv } from '@grafana/runtime';
import { makeDatasourceSetup } from '../spec/helper/setup';
import { useExplorePageTitle } from './useExplorePageTitle';
describe('useExplorePageTitle', () => {
    it('changes the document title of the explore page to include the datasource in use', () => __awaiter(void 0, void 0, void 0, function* () {
        const datasources = [
            makeDatasourceSetup({ name: 'loki', uid: 'loki-uid' }),
            makeDatasourceSetup({ name: 'elastic', uid: 'elastic-uid' }),
        ];
        setDataSourceSrv({
            get(datasource) {
                var _a, _b;
                let ds;
                if (!datasource) {
                    ds = (_a = datasources[0]) === null || _a === void 0 ? void 0 : _a.api;
                }
                else {
                    ds = (_b = datasources.find((ds) => typeof datasource === 'string'
                        ? ds.api.name === datasource || ds.api.uid === datasource
                        : ds.api.uid === (datasource === null || datasource === void 0 ? void 0 : datasource.uid))) === null || _b === void 0 ? void 0 : _b.api;
                }
                if (ds) {
                    return Promise.resolve(ds);
                }
                return Promise.reject();
            },
            getInstanceSettings: jest.fn(),
            getList: jest.fn(),
            reload: jest.fn(),
        });
        renderHook(() => useExplorePageTitle({ panes: JSON.stringify({ a: { datasource: 'loki-uid' } }) }), {
            wrapper: TestProvider,
        });
        yield waitFor(() => {
            expect(global.document.title).toEqual(expect.stringContaining('loki'));
            expect(global.document.title).toEqual(expect.not.stringContaining('elastic'));
        });
    }));
    it('changes the document title to include the two datasources in use in split view mode', () => __awaiter(void 0, void 0, void 0, function* () {
        const datasources = [
            makeDatasourceSetup({ name: 'loki', uid: 'loki-uid' }),
            makeDatasourceSetup({ name: 'elastic', uid: 'elastic-uid' }),
        ];
        setDataSourceSrv({
            get(datasource) {
                var _a, _b;
                let ds;
                if (!datasource) {
                    ds = (_a = datasources[0]) === null || _a === void 0 ? void 0 : _a.api;
                }
                else {
                    ds = (_b = datasources.find((ds) => typeof datasource === 'string'
                        ? ds.api.name === datasource || ds.api.uid === datasource
                        : ds.api.uid === (datasource === null || datasource === void 0 ? void 0 : datasource.uid))) === null || _b === void 0 ? void 0 : _b.api;
                }
                if (ds) {
                    return Promise.resolve(ds);
                }
                return Promise.reject();
            },
            getInstanceSettings: jest.fn(),
            getList: jest.fn(),
            reload: jest.fn(),
        });
        renderHook(() => useExplorePageTitle({
            panes: JSON.stringify({ a: { datasource: 'loki-uid' }, b: { datasource: 'elastic-uid' } }),
        }), {
            wrapper: TestProvider,
        });
        yield waitFor(() => {
            expect(global.document.title).toEqual(expect.stringContaining('loki | elastic'));
        });
    }));
});
//# sourceMappingURL=useExplorePageTitle.test.js.map