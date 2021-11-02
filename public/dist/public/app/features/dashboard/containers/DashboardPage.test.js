import { __assign, __extends } from "tslib";
import React from 'react';
import { Provider } from 'react-redux';
import { render, screen } from '@testing-library/react';
import { UnthemedDashboardPage } from './DashboardPage';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
import { DashboardModel } from '../state';
import { configureStore } from '../../../store/configureStore';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { DashboardInitPhase, DashboardRoutes } from 'app/types';
import { notifyApp } from 'app/core/actions';
import { selectors } from '@grafana/e2e-selectors';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { createTheme } from '@grafana/data';
jest.mock('app/features/dashboard/components/DashboardSettings/GeneralSettings', function () {
    var GeneralSettings = /** @class */ (function (_super) {
        __extends(GeneralSettings, _super);
        function GeneralSettings() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        GeneralSettings.prototype.render = function () {
            return React.createElement(React.Fragment, null, "general settings");
        };
        return GeneralSettings;
    }(React.Component));
    return { GeneralSettings: GeneralSettings };
});
jest.mock('app/features/query/components/QueryGroup', function () {
    return {
        QueryGroup: function () { return null; },
    };
});
jest.mock('app/core/core', function () { return ({
    appEvents: {
        subscribe: function () {
            return { unsubscribe: function () { } };
        },
    },
}); });
jest.mock('react-virtualized-auto-sizer', function () {
    // The size of the children need to be small enough to be outside the view.
    // So it does not trigger the query to be run by the PanelQueryRunner.
    return function (_a) {
        var children = _a.children;
        return children({ height: 1, width: 1 });
    };
});
function getTestDashboard(overrides, metaOverrides) {
    var data = Object.assign({
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
    var meta = Object.assign({ canSave: true, canEdit: true }, metaOverrides);
    return new DashboardModel(data, meta);
}
function dashboardPageScenario(description, scenarioFn) {
    describe(description, function () {
        var setupFn;
        var ctx = {
            setup: function (fn) {
                setupFn = fn;
            },
            mount: function (propOverrides) {
                var store = configureStore();
                var props = __assign(__assign({}, getRouteComponentProps({
                    match: { params: { slug: 'my-dash', uid: '11' } },
                    route: { routeName: DashboardRoutes.Normal },
                })), { initPhase: DashboardInitPhase.NotStarted, isInitSlow: false, initError: null, initDashboard: jest.fn(), notifyApp: mockToolkitActionCreator(notifyApp), cleanUpDashboardAndVariables: jest.fn(), cancelVariables: jest.fn(), templateVarsChangedInUrl: jest.fn(), dashboard: null, theme: createTheme() });
                Object.assign(props, propOverrides);
                ctx.props = props;
                ctx.dashboard = props.dashboard;
                var _a = render(React.createElement(Provider, { store: store },
                    React.createElement(Router, { history: locationService.getHistory() },
                        React.createElement(UnthemedDashboardPage, __assign({}, props))))), container = _a.container, rerender = _a.rerender, unmount = _a.unmount;
                ctx.container = container;
                ctx.rerender = function (newProps) {
                    Object.assign(props, newProps);
                    rerender(React.createElement(Provider, { store: store },
                        React.createElement(Router, { history: locationService.getHistory() },
                            React.createElement(UnthemedDashboardPage, __assign({}, props)))));
                };
                ctx.unmount = unmount;
            },
            props: {},
            rerender: function () { },
            unmount: function () { },
        };
        beforeEach(function () {
            setupFn();
        });
        scenarioFn(ctx);
    });
}
describe('DashboardPage', function () {
    dashboardPageScenario('Given initial state', function (ctx) {
        ctx.setup(function () {
            ctx.mount();
        });
        it('Should call initDashboard on mount', function () {
            expect(ctx.props.initDashboard).toBeCalledWith({
                fixUrl: true,
                routeName: 'normal-dashboard',
                urlSlug: 'my-dash',
                urlUid: '11',
            });
            expect(ctx.container).toBeEmptyDOMElement();
        });
    });
    dashboardPageScenario('Given dashboard slow loading state', function (ctx) {
        ctx.setup(function () {
            ctx.mount();
            ctx.rerender({ isInitSlow: true });
        });
        it('Should show spinner', function () {
            expect(screen.getByText('Cancel loading dashboard')).toBeInTheDocument();
        });
    });
    dashboardPageScenario('Given a simple dashboard', function (ctx) {
        ctx.setup(function () {
            ctx.mount();
            ctx.rerender({ dashboard: getTestDashboard() });
        });
        it('Should render panels', function () {
            expect(screen.getByText('My panel title')).toBeInTheDocument();
        });
        it('Should update title', function () {
            expect(document.title).toBe('My dashboard - Grafana');
        });
    });
    dashboardPageScenario('When going into view mode', function (ctx) {
        ctx.setup(function () {
            ctx.mount({
                dashboard: getTestDashboard(),
                queryParams: { viewPanel: '1' },
            });
        });
        it('Should render panel in view mode', function () {
            var _a, _b;
            expect((_a = ctx.dashboard) === null || _a === void 0 ? void 0 : _a.panelInView).toBeDefined();
            expect((_b = ctx.dashboard) === null || _b === void 0 ? void 0 : _b.panels[0].isViewing).toBe(true);
        });
        it('Should reset state when leaving', function () {
            var _a, _b;
            ctx.rerender({ queryParams: {} });
            expect((_a = ctx.dashboard) === null || _a === void 0 ? void 0 : _a.panelInView).toBeUndefined();
            expect((_b = ctx.dashboard) === null || _b === void 0 ? void 0 : _b.panels[0].isViewing).toBe(false);
        });
    });
    dashboardPageScenario('When going into edit mode', function (ctx) {
        ctx.setup(function () {
            ctx.mount({
                dashboard: getTestDashboard(),
                queryParams: { editPanel: '1' },
            });
        });
        it('Should render panel in edit mode', function () {
            var _a;
            expect((_a = ctx.dashboard) === null || _a === void 0 ? void 0 : _a.panelInEdit).toBeDefined();
        });
        it('Should render panel editor', function () {
            expect(screen.getByTitle('Apply changes and go back to dashboard')).toBeInTheDocument();
        });
        it('Should reset state when leaving', function () {
            ctx.rerender({ queryParams: {} });
            expect(screen.queryByTitle('Apply changes and go back to dashboard')).not.toBeInTheDocument();
        });
    });
    dashboardPageScenario('When dashboard unmounts', function (ctx) {
        ctx.setup(function () {
            ctx.mount();
            ctx.rerender({ dashboard: getTestDashboard() });
            ctx.unmount();
        });
        it('Should call close action', function () {
            expect(ctx.props.cleanUpDashboardAndVariables).toHaveBeenCalledTimes(1);
        });
    });
    dashboardPageScenario('When dashboard changes', function (ctx) {
        ctx.setup(function () {
            ctx.mount();
            ctx.rerender({ dashboard: getTestDashboard() });
            ctx.rerender({
                match: {
                    params: { uid: 'new-uid' },
                },
                dashboard: getTestDashboard({ title: 'Another dashboard' }),
            });
        });
        it('Should call clean up action and init', function () {
            expect(ctx.props.cleanUpDashboardAndVariables).toHaveBeenCalledTimes(1);
            expect(ctx.props.initDashboard).toHaveBeenCalledTimes(2);
        });
    });
    dashboardPageScenario('No kiosk mode tv', function (ctx) {
        ctx.setup(function () {
            ctx.mount({ dashboard: getTestDashboard() });
            ctx.rerender({ dashboard: ctx.dashboard });
        });
        it('should render dashboard page toolbar and submenu', function () {
            expect(screen.queryAllByLabelText(selectors.pages.Dashboard.DashNav.nav)).toHaveLength(1);
            expect(screen.queryAllByLabelText(selectors.pages.Dashboard.SubMenu.submenu)).toHaveLength(1);
        });
    });
    dashboardPageScenario('When in full kiosk mode', function (ctx) {
        ctx.setup(function () {
            ctx.mount({
                queryParams: { kiosk: true },
                dashboard: getTestDashboard(),
            });
            ctx.rerender({ dashboard: ctx.dashboard });
        });
        it('should not render page toolbar and submenu', function () {
            expect(screen.queryAllByLabelText(selectors.pages.Dashboard.DashNav.nav)).toHaveLength(0);
            expect(screen.queryAllByLabelText(selectors.pages.Dashboard.SubMenu.submenu)).toHaveLength(0);
        });
    });
});
//# sourceMappingURL=DashboardPage.test.js.map