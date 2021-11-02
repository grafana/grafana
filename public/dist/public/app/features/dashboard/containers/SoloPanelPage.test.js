import { __assign, __awaiter, __extends, __generator } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import { SoloPanelPage } from './SoloPanelPage';
import { DashboardModel } from '../state';
import { DashboardRoutes } from 'app/types';
import { getRouteComponentProps } from '../../../core/navigation/__mocks__/routeProps';
jest.mock('app/features/dashboard/components/DashboardSettings/GeneralSettings', function () { return ({}); });
jest.mock('app/features/dashboard/dashgrid/DashboardPanel', function () {
    var DashboardPanel = /** @class */ (function (_super) {
        __extends(DashboardPanel, _super);
        function DashboardPanel() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        DashboardPanel.prototype.render = function () {
            var _a;
            // In this test we only check whether a new panel has arrived in the props
            return React.createElement(React.Fragment, null, (_a = this.props.panel) === null || _a === void 0 ? void 0 : _a.title);
        };
        return DashboardPanel;
    }(React.Component));
    return { DashboardPanel: DashboardPanel };
});
function getTestDashboard(overrides, metaOverrides) {
    var data = Object.assign({
        title: 'My dashboard',
        panels: [
            {
                id: 1,
                type: 'graph',
                title: 'My graph',
                gridPos: { x: 0, y: 0, w: 1, h: 1 },
            },
        ],
    }, overrides);
    var meta = Object.assign({ canSave: true, canEdit: true }, metaOverrides);
    return new DashboardModel(data, meta);
}
function soloPanelPageScenario(description, scenarioFn) {
    describe(description, function () {
        var setupFn;
        var ctx = {
            setup: function (fn) {
                setupFn = fn;
            },
            setDashboard: function (overrides, metaOverrides) {
                ctx.dashboard = getTestDashboard(overrides, metaOverrides);
            },
            setSecondaryDashboard: function (overrides, metaOverrides) {
                ctx.secondaryDashboard = getTestDashboard(overrides, metaOverrides);
            },
            mount: function (propOverrides) {
                var props = __assign(__assign({}, getRouteComponentProps({
                    match: {
                        params: { slug: 'my-dash', uid: '11' },
                    },
                    queryParams: {
                        panelId: '1',
                    },
                    route: { routeName: DashboardRoutes.Normal },
                })), { initDashboard: jest.fn(), dashboard: null });
                Object.assign(props, propOverrides);
                ctx.dashboard = props.dashboard;
                var rerender = render(React.createElement(SoloPanelPage, __assign({}, props))).rerender;
                // prop updates will be submitted by rerendering the same component with different props
                ctx.rerender = function (newProps) {
                    Object.assign(props, newProps);
                    rerender(React.createElement(SoloPanelPage, __assign({}, props)));
                };
            },
            rerender: function () {
                // will be replaced while mount() is called
            },
        };
        beforeEach(function () {
            setupFn();
        });
        scenarioFn(ctx);
    });
}
describe('SoloPanelPage', function () {
    soloPanelPageScenario('Given initial state', function (ctx) {
        ctx.setup(function () {
            ctx.mount();
        });
        it('Should render nothing', function () {
            expect(screen.queryByText(/Loading/)).not.toBeNull();
        });
    });
    soloPanelPageScenario('Dashboard init completed ', function (ctx) {
        ctx.setup(function () {
            // Needed for AutoSizer to work in test
            Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 });
            Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 500 });
            ctx.mount();
            ctx.setDashboard();
            expect(ctx.dashboard).not.toBeNull();
            // the componentDidMount will change the dashboard prop to the new dashboard
            // emulate this by rerendering with new props
            ctx.rerender({ dashboard: ctx.dashboard });
        });
        it('Should render dashboard grid', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // check if the panel title has arrived in the DashboardPanel mock
                expect(screen.queryByText(/My graph/)).not.toBeNull();
                return [2 /*return*/];
            });
        }); });
    });
    soloPanelPageScenario('When user navigates to other SoloPanelPage', function (ctx) {
        ctx.setup(function () {
            ctx.mount();
            ctx.setDashboard({ uid: 1, panels: [{ id: 1, type: 'graph', title: 'Panel 1' }] });
            ctx.setSecondaryDashboard({ uid: 2, panels: [{ id: 1, type: 'graph', title: 'Panel 2' }] });
        });
        it('Should show other graph', function () {
            // check that the title in the DashboardPanel has changed
            ctx.rerender({ dashboard: ctx.dashboard });
            expect(screen.queryByText(/Panel 1/)).not.toBeNull();
            ctx.rerender({ dashboard: ctx.secondaryDashboard });
            expect(screen.queryByText(/Panel 1/)).toBeNull();
            expect(screen.queryByText(/Panel 2/)).not.toBeNull();
        });
    });
});
//# sourceMappingURL=SoloPanelPage.test.js.map