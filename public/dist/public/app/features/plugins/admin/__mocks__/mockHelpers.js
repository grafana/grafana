import { __assign } from "tslib";
import { mocked } from 'ts-jest/utils';
import { setBackendSrv } from '@grafana/runtime';
import { API_ROOT, GRAFANA_API_ROOT } from '../constants';
import { RequestStatus, PluginListDisplayMode, } from '../types';
import * as permissions from '../permissions';
import remotePluginMock from './remotePlugin.mock';
import localPluginMock from './localPlugin.mock';
import catalogPluginMock from './catalogPlugin.mock';
// Returns a sample mock for a CatalogPlugin plugin with the possibility to extend it
export var getCatalogPluginMock = function (overrides) { return (__assign(__assign({}, catalogPluginMock), overrides)); };
// Returns a sample mock for a local (installed) plugin with the possibility to extend it
export var getLocalPluginMock = function (overrides) { return (__assign(__assign({}, localPluginMock), overrides)); };
// Returns a sample mock for a remote plugin with the possibility to extend it
export var getRemotePluginMock = function (overrides) { return (__assign(__assign({}, remotePluginMock), overrides)); };
// Returns a mock for the Redux store state of plugins
export var getPluginsStateMock = function (plugins) {
    if (plugins === void 0) { plugins = []; }
    return ({
        // @ts-ignore - We don't need the rest of the properties here as we are using the "new" reducer (public/app/features/plugins/admin/state/reducer.ts)
        items: {
            ids: plugins.map(function (_a) {
                var id = _a.id;
                return id;
            }),
            entities: plugins.reduce(function (prev, current) {
                var _a;
                return (__assign(__assign({}, prev), (_a = {}, _a[current.id] = current, _a)));
            }, {}),
        },
        requests: {
            'plugins/fetchAll': {
                status: RequestStatus.Fulfilled,
            },
            'plugins/fetchDetails': {
                status: RequestStatus.Fulfilled,
            },
        },
        settings: {
            displayMode: PluginListDisplayMode.Grid,
        },
        // Backward compatibility
        plugins: [],
        errors: [],
        searchQuery: '',
        hasFetched: false,
        dashboards: [],
        isLoadingPluginDashboards: false,
        panels: {},
    });
};
// Mocks a plugin by considering what needs to be mocked from GCOM and what needs to be mocked locally (local Grafana API)
export var mockPluginApis = function (_a) {
    var remoteOverride = _a.remote, localOverride = _a.local, versions = _a.versions;
    var remote = getRemotePluginMock(remoteOverride);
    var local = getLocalPluginMock(localOverride);
    var original = jest.requireActual('@grafana/runtime');
    var originalBackendSrv = original.getBackendSrv();
    setBackendSrv(__assign(__assign({}, originalBackendSrv), { get: function (path) {
            // Mock GCOM plugins (remote) if necessary
            if (remote && path === GRAFANA_API_ROOT + "/plugins") {
                return Promise.resolve({ items: [remote] });
            }
            // Mock GCOM single plugin page (remote) if necessary
            if (remote && path === GRAFANA_API_ROOT + "/plugins/" + remote.slug) {
                return Promise.resolve(remote);
            }
            // Mock versions
            if (versions && path === GRAFANA_API_ROOT + "/plugins/" + remote.slug + "/versions") {
                return Promise.resolve({ items: versions });
            }
            // Mock local plugin settings (installed) if necessary
            if (local && path === API_ROOT + "/" + local.id + "/settings") {
                return Promise.resolve(local);
            }
            // Mock local plugin listing (of necessary)
            if (local && path === API_ROOT) {
                return Promise.resolve([local]);
            }
            // Fall back to the original .get() in other cases
            return originalBackendSrv.get(path);
        } }));
};
jest.mock('../permissions');
export function mockUserPermissions(options) {
    var mock = mocked(permissions);
    mock.isDataSourceEditor.mockReturnValue(options.isDataSourceEditor);
    mock.isOrgAdmin.mockReturnValue(options.isOrgAdmin);
    mock.isGrafanaAdmin.mockReturnValue(options.isAdmin);
}
//# sourceMappingURL=mockHelpers.js.map