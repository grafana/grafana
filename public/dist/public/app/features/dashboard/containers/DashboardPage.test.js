import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import { KBarProvider } from 'kbar';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { useEffectOnce } from 'react-use';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { createTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, locationService, setDataSourceSrv } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { AppChrome } from 'app/core/components/AppChrome/AppChrome';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { DashboardInitPhase, DashboardRoutes } from 'app/types';
import { configureStore } from '../../../store/configureStore';
import { setDashboardSrv } from '../services/DashboardSrv';
import { createDashboardModelFixture } from '../state/__fixtures__/dashboardFixtures';
import { UnthemedDashboardPage } from './DashboardPage';
jest.mock('app/features/dashboard/dashgrid/LazyLoader', () => {
    const LazyLoader = ({ children, onLoad }) => {
        useEffectOnce(() => {
            onLoad === null || onLoad === void 0 ? void 0 : onLoad();
        });
        return React.createElement(React.Fragment, null, typeof children === 'function' ? children({ isInView: true }) : children);
    };
    return { LazyLoader };
});
jest.mock('app/features/dashboard/components/DashboardSettings/GeneralSettings', () => {
    class GeneralSettings extends React.Component {
        render() {
            return React.createElement(React.Fragment, null, "general settings");
        }
    }
    return { GeneralSettings };
});
jest.mock('app/features/query/components/QueryGroup', () => {
    return {
        QueryGroup: () => null,
    };
});
jest.mock('app/core/core', () => ({
    appEvents: {
        subscribe: () => {
            return { unsubscribe: () => { } };
        },
    },
    contextSrv: {
        user: { orgId: 1 },
    },
}));
jest.mock('react-virtualized-auto-sizer', () => {
    // The size of the children need to be small enough to be outside the view.
    // So it does not trigger the query to be run by the PanelQueryRunner.
    return ({ children }) => children({ height: 1, width: 1 });
});
function getTestDashboard(overrides, metaOverrides) {
    const data = Object.assign({
        title: 'My dashboard',
        panels: [
            {
                id: 1,
                type: 'timeseries',
                title: 'My panel title',
                gridPos: { x: 0, y: 0, w: 1, h: 1 },
            },
        ],
    }, overrides);
    return createDashboardModelFixture(data, metaOverrides);
}
const mockInitDashboard = jest.fn();
const mockCleanUpDashboardAndVariables = jest.fn();
function setup(propOverrides) {
    config.bootData.navTree = [
        { text: 'Dashboards', id: 'dashboards/browse' },
        { text: 'Home', id: HOME_NAV_ID },
        {
            text: 'Help',
            id: 'help',
        },
    ];
    const store = configureStore();
    const props = Object.assign(Object.assign({}, getRouteComponentProps({
        match: { params: { slug: 'my-dash', uid: '11' } },
        route: { routeName: DashboardRoutes.Normal },
    })), { navIndex: {
            'dashboards/browse': {
                text: 'Dashboards',
                id: 'dashboards/browse',
                parentItem: { text: 'Home', id: HOME_NAV_ID },
            },
            [HOME_NAV_ID]: { text: 'Home', id: HOME_NAV_ID },
        }, initPhase: DashboardInitPhase.NotStarted, initError: null, initDashboard: mockInitDashboard, notifyApp: mockToolkitActionCreator(notifyApp), cleanUpDashboardAndVariables: mockCleanUpDashboardAndVariables, cancelVariables: jest.fn(), templateVarsChangedInUrl: jest.fn(), dashboard: null, theme: createTheme() });
    Object.assign(props, propOverrides);
    const context = getGrafanaContextMock();
    const { unmount, rerender } = render(React.createElement(GrafanaContext.Provider, { value: context },
        React.createElement(Provider, { store: store },
            React.createElement(Router, { history: locationService.getHistory() },
                React.createElement(UnthemedDashboardPage, Object.assign({}, props))))));
    const wrappedRerender = (newProps) => {
        Object.assign(props, newProps);
        return rerender(React.createElement(GrafanaContext.Provider, { value: context },
            React.createElement(Provider, { store: store },
                React.createElement(Router, { history: locationService.getHistory() },
                    React.createElement(UnthemedDashboardPage, Object.assign({}, props))))));
    };
    return { rerender: wrappedRerender, unmount };
}
describe('DashboardPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('Should call initDashboard on mount', () => {
        setup();
        expect(mockInitDashboard).toBeCalledWith({
            fixUrl: true,
            routeName: 'normal-dashboard',
            urlSlug: 'my-dash',
            urlUid: '11',
            keybindingSrv: expect.anything(),
        });
    });
    describe('Given a simple dashboard', () => {
        it('Should render panels', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({ dashboard: getTestDashboard() });
            expect(yield screen.findByText('My panel title')).toBeInTheDocument();
        }));
        it('Should update title', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({ dashboard: getTestDashboard() });
            yield waitFor(() => {
                expect(document.title).toBe('My dashboard - Dashboards - Grafana');
            });
        }));
        it('only calls initDashboard once when wrapped in AppChrome', () => __awaiter(void 0, void 0, void 0, function* () {
            const props = Object.assign(Object.assign({}, getRouteComponentProps({
                match: { params: { slug: 'my-dash', uid: '11' } },
                route: { routeName: DashboardRoutes.Normal },
            })), { navIndex: {
                    'dashboards/browse': {
                        text: 'Dashboards',
                        id: 'dashboards/browse',
                        parentItem: { text: 'Home', id: HOME_NAV_ID },
                    },
                    [HOME_NAV_ID]: { text: 'Home', id: HOME_NAV_ID },
                }, initPhase: DashboardInitPhase.Completed, initError: null, initDashboard: mockInitDashboard, notifyApp: mockToolkitActionCreator(notifyApp), cleanUpDashboardAndVariables: mockCleanUpDashboardAndVariables, cancelVariables: jest.fn(), templateVarsChangedInUrl: jest.fn(), dashboard: getTestDashboard(), theme: createTheme() });
            render(React.createElement(KBarProvider, null,
                React.createElement(TestProvider, null,
                    React.createElement(AppChrome, null,
                        React.createElement(UnthemedDashboardPage, Object.assign({}, props))))));
            yield screen.findByText('My dashboard');
            expect(mockInitDashboard).toHaveBeenCalledTimes(1);
        }));
    });
    describe('When going into view mode', () => {
        beforeEach(() => {
            setDataSourceSrv({
                get: jest.fn().mockResolvedValue({ getRef: jest.fn(), query: jest.fn().mockResolvedValue([]) }),
                getInstanceSettings: jest.fn().mockReturnValue({ meta: {} }),
                getList: jest.fn(),
                reload: jest.fn(),
            });
            setDashboardSrv({
                getCurrent: () => getTestDashboard(),
            });
        });
        it('Should render panel in view mode', () => __awaiter(void 0, void 0, void 0, function* () {
            const dashboard = getTestDashboard();
            setup({
                dashboard,
                queryParams: { viewPanel: '1' },
            });
            yield waitFor(() => {
                expect(dashboard.panelInView).toBeDefined();
                expect(dashboard.panels[0].isViewing).toBe(true);
            });
        }));
        it('Should reset state when leaving', () => __awaiter(void 0, void 0, void 0, function* () {
            const dashboard = getTestDashboard();
            const { rerender } = setup({
                dashboard,
                queryParams: { viewPanel: '1' },
            });
            rerender({ queryParams: {}, dashboard });
            yield waitFor(() => {
                expect(dashboard.panelInView).toBeUndefined();
                expect(dashboard.panels[0].isViewing).toBe(false);
            });
        }));
    });
    describe('When going into edit mode', () => {
        it('Should render panel in edit mode', () => __awaiter(void 0, void 0, void 0, function* () {
            const dashboard = getTestDashboard();
            setup({
                dashboard,
                queryParams: { editPanel: '1' },
            });
            yield waitFor(() => {
                expect(dashboard.panelInEdit).toBeDefined();
            });
        }));
    });
    describe('When dashboard unmounts', () => {
        it('Should call close action', () => __awaiter(void 0, void 0, void 0, function* () {
            const { rerender, unmount } = setup();
            rerender({ dashboard: getTestDashboard() });
            unmount();
            yield waitFor(() => {
                expect(mockCleanUpDashboardAndVariables).toHaveBeenCalledTimes(1);
            });
        }));
    });
    describe('When dashboard changes', () => {
        it('Should call clean up action and init', () => __awaiter(void 0, void 0, void 0, function* () {
            const { rerender } = setup();
            rerender({ dashboard: getTestDashboard() });
            rerender({
                match: { params: { uid: 'new-uid' } },
                dashboard: getTestDashboard({ title: 'Another dashboard' }),
            });
            yield waitFor(() => {
                expect(mockCleanUpDashboardAndVariables).toHaveBeenCalledTimes(1);
                expect(mockInitDashboard).toHaveBeenCalledTimes(2);
            });
        }));
    });
    describe('No kiosk mode tv', () => {
        it('should render dashboard page toolbar and submenu', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({ dashboard: getTestDashboard() });
            expect(yield screen.findAllByTestId(selectors.pages.Dashboard.DashNav.navV2)).toHaveLength(1);
            expect(screen.getAllByLabelText(selectors.pages.Dashboard.SubMenu.submenu)).toHaveLength(1);
        }));
    });
    describe('When in full kiosk mode', () => {
        it('should not render page toolbar and submenu', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({ dashboard: getTestDashboard(), queryParams: { kiosk: true } });
            yield waitFor(() => {
                expect(screen.queryAllByTestId(selectors.pages.Dashboard.DashNav.navV2)).toHaveLength(0);
                expect(screen.queryAllByLabelText(selectors.pages.Dashboard.SubMenu.submenu)).toHaveLength(0);
            });
        }));
    });
});
//# sourceMappingURL=DashboardPage.test.js.map