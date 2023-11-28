import { __awaiter } from "tslib";
import { waitFor, within } from '@testing-library/dom';
import { render, screen } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import { fromPairs } from 'lodash';
import { stringify } from 'querystring';
import React from 'react';
import { Provider } from 'react-redux';
import { Route, Router } from 'react-router-dom';
import { of } from 'rxjs';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { PluginType, } from '@grafana/data';
import { setDataSourceSrv, setEchoSrv, locationService, HistoryWrapper, setPluginExtensionGetter, setBackendSrv, getBackendSrv, getDataSourceSrv, getEchoSrv, setLocationService, } from '@grafana/runtime';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { GrafanaRoute } from 'app/core/navigation/GrafanaRoute';
import { Echo } from 'app/core/services/echo/Echo';
import { setLastUsedDatasourceUID } from 'app/core/utils/explore';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { configureStore } from 'app/store/configureStore';
import { initialUserState } from '../../../profile/state/reducers';
import ExplorePage from '../../ExplorePage';
export function setupExplore(options) {
    const previousBackendSrv = getBackendSrv();
    setBackendSrv({
        datasourceRequest: jest.fn().mockRejectedValue(undefined),
        delete: jest.fn().mockRejectedValue(undefined),
        fetch: jest.fn().mockImplementation((req) => {
            const data = {};
            if (req.url.startsWith('/api/datasources/correlations') && req.method === 'GET') {
                data.correlations = [];
                data.totalCount = 0;
            }
            else if (req.url.startsWith('/api/query-history') && req.method === 'GET') {
                data.result = (options === null || options === void 0 ? void 0 : options.queryHistory) || {};
            }
            return of({ data });
        }),
        get: jest.fn(),
        patch: jest.fn().mockRejectedValue(undefined),
        post: jest.fn(),
        put: jest.fn().mockRejectedValue(undefined),
        request: jest.fn().mockRejectedValue(undefined),
    });
    setPluginExtensionGetter(() => ({ extensions: [] }));
    // Clear this up otherwise it persists data source selection
    // TODO: probably add test for that too
    if ((options === null || options === void 0 ? void 0 : options.clearLocalStorage) !== false) {
        window.localStorage.clear();
    }
    if (options === null || options === void 0 ? void 0 : options.prevUsedDatasource) {
        setLastUsedDatasourceUID(options === null || options === void 0 ? void 0 : options.prevUsedDatasource.orgId, options === null || options === void 0 ? void 0 : options.prevUsedDatasource.datasource);
    }
    // Create this here so any mocks are recreated on setup and don't retain state
    const defaultDatasources = [
        makeDatasourceSetup(),
        makeDatasourceSetup({ name: 'elastic', id: 2 }),
        makeDatasourceSetup({ name: MIXED_DATASOURCE_NAME, uid: MIXED_DATASOURCE_NAME, id: 999 }),
    ];
    const dsSettings = (options === null || options === void 0 ? void 0 : options.datasources) || defaultDatasources;
    const previousDataSourceSrv = getDataSourceSrv();
    setDataSourceSrv({
        getList() {
            return dsSettings.map((d) => d.settings);
        },
        getInstanceSettings(ref) {
            const allSettings = dsSettings.map((d) => d.settings);
            return allSettings.find((x) => x.name === ref || x.uid === ref || x.uid === (ref === null || ref === void 0 ? void 0 : ref.uid)) || allSettings[0];
        },
        get(datasource) {
            var _a, _b;
            let ds;
            if (!datasource) {
                ds = (_a = dsSettings[0]) === null || _a === void 0 ? void 0 : _a.api;
            }
            else {
                ds = (_b = dsSettings.find((ds) => typeof datasource === 'string'
                    ? ds.api.name === datasource || ds.api.uid === datasource
                    : ds.api.uid === (datasource === null || datasource === void 0 ? void 0 : datasource.uid))) === null || _b === void 0 ? void 0 : _b.api;
            }
            if (ds) {
                return Promise.resolve(ds);
            }
            return Promise.reject();
        },
        reload() { },
    });
    const previousEchoSrv = getEchoSrv();
    setEchoSrv(new Echo());
    const storeState = configureStore();
    storeState.getState().user = Object.assign(Object.assign({}, initialUserState), { orgId: 1, timeZone: 'utc' });
    storeState.getState().navIndex = {
        explore: {
            id: 'explore',
            text: 'Explore',
            subTitle: 'Explore your data',
            icon: 'compass',
            url: '/explore',
        },
    };
    const history = createMemoryHistory({
        initialEntries: [{ pathname: '/explore', search: stringify(options === null || options === void 0 ? void 0 : options.urlParams) }],
    });
    const location = new HistoryWrapper(history);
    setLocationService(location);
    const contextMock = getGrafanaContextMock({ location });
    const { unmount, container } = render(React.createElement(Provider, { store: storeState },
        React.createElement(GrafanaContext.Provider, { value: contextMock },
            React.createElement(Router, { history: history },
                React.createElement(Route, { path: "/explore", exact: true, render: (props) => React.createElement(GrafanaRoute, Object.assign({}, props, { route: { component: ExplorePage, path: '/explore' } })) })))));
    exploreTestsHelper.tearDownExplore = (options) => {
        setDataSourceSrv(previousDataSourceSrv);
        setEchoSrv(previousEchoSrv);
        setBackendSrv(previousBackendSrv);
        setLocationService(locationService);
        if ((options === null || options === void 0 ? void 0 : options.clearLocalStorage) !== false) {
            window.localStorage.clear();
        }
    };
    return {
        datasources: fromPairs(dsSettings.map((d) => [d.api.name, d.api])),
        store: storeState,
        unmount,
        container,
        location,
    };
}
export function makeDatasourceSetup({ name = 'loki', id = 1, uid: uidOverride, } = {}) {
    const uid = uidOverride || `${name}-uid`;
    const type = 'logs';
    const meta = {
        info: {
            author: {
                name: 'Grafana',
            },
            description: '',
            links: [],
            screenshots: [],
            updated: '',
            version: '',
            logos: {
                small: '',
                large: '',
            },
        },
        id: id.toString(),
        module: 'loki',
        name,
        type: PluginType.datasource,
        baseUrl: '',
    };
    return {
        settings: {
            id,
            uid,
            type,
            name,
            meta,
            access: 'proxy',
            jsonData: {},
            readOnly: false,
        },
        api: {
            components: {
                QueryEditor(props) {
                    return (React.createElement("div", null,
                        React.createElement("input", { "aria-label": "query", defaultValue: props.query.expr, onChange: (event) => {
                                props.onChange(Object.assign(Object.assign({}, props.query), { expr: event.target.value }));
                            } }),
                        name,
                        " Editor input: ",
                        props.query.expr));
                },
            },
            name: name,
            uid: uid,
            query: jest.fn(),
            getRef: () => ({ type, uid }),
            meta,
        },
    };
}
export const waitForExplore = (exploreId = 'left') => {
    return waitFor(() => __awaiter(void 0, void 0, void 0, function* () {
        const container = screen.getAllByTestId('data-testid Explore');
        return within(container[exploreId === 'left' ? 0 : 1]);
    }));
};
export const tearDown = (options) => {
    var _a;
    (_a = exploreTestsHelper.tearDownExplore) === null || _a === void 0 ? void 0 : _a.call(exploreTestsHelper, options);
};
export const withinExplore = (exploreId) => {
    const container = screen.getAllByTestId('data-testid Explore');
    return within(container[exploreId === 'left' ? 0 : 1]);
};
const exploreTestsHelper = {
    setupExplore,
    tearDownExplore: undefined,
};
//# sourceMappingURL=setup.js.map