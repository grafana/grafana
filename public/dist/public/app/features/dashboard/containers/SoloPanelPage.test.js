import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { DashboardRoutes } from 'app/types';
import { getRouteComponentProps } from '../../../core/navigation/__mocks__/routeProps';
import { createDashboardModelFixture } from '../state/__fixtures__/dashboardFixtures';
import { SoloPanelPage } from './SoloPanelPage';
jest.mock('app/features/dashboard/components/DashboardSettings/GeneralSettings', () => ({}));
jest.mock('app/features/dashboard/dashgrid/DashboardPanel', () => {
    class DashboardPanel extends React.Component {
        render() {
            var _a;
            // In this test we only check whether a new panel has arrived in the props
            return React.createElement(React.Fragment, null, (_a = this.props.panel) === null || _a === void 0 ? void 0 : _a.title);
        }
    }
    return { DashboardPanel };
});
function getTestDashboard(overrides, metaOverrides) {
    const data = Object.assign({
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
    return createDashboardModelFixture(data, metaOverrides);
}
function soloPanelPageScenario(description, scenarioFn) {
    describe(description, () => {
        let setupFn;
        const ctx = {
            setup: (fn) => {
                setupFn = fn;
            },
            setDashboard: (overrides, metaOverrides) => {
                ctx.dashboard = getTestDashboard(overrides, metaOverrides);
            },
            setSecondaryDashboard: (overrides, metaOverrides) => {
                ctx.secondaryDashboard = getTestDashboard(overrides, metaOverrides);
            },
            mount: (propOverrides) => {
                const props = Object.assign(Object.assign({}, getRouteComponentProps({
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
                const context = getGrafanaContextMock();
                const renderPage = (props) => (React.createElement(GrafanaContext.Provider, { value: context },
                    React.createElement(SoloPanelPage, Object.assign({}, props))));
                let { rerender } = render(renderPage(props));
                // prop updates will be submitted by rerendering the same component with different props
                ctx.rerender = (newProps) => {
                    rerender(renderPage(Object.assign(props, newProps)));
                };
            },
            rerender: () => {
                // will be replaced while mount() is called
            },
        };
        beforeEach(() => {
            setupFn();
        });
        scenarioFn(ctx);
    });
}
describe('SoloPanelPage', () => {
    soloPanelPageScenario('Given initial state', (ctx) => {
        ctx.setup(() => {
            ctx.mount();
        });
        it('Should render nothing', () => {
            expect(screen.queryByText(/Loading/)).not.toBeNull();
        });
    });
    soloPanelPageScenario('Dashboard init completed ', (ctx) => {
        ctx.setup(() => {
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
        it('Should render dashboard grid', () => __awaiter(void 0, void 0, void 0, function* () {
            // check if the panel title has arrived in the DashboardPanel mock
            expect(screen.queryByText(/My graph/)).not.toBeNull();
        }));
    });
    soloPanelPageScenario('When user navigates to other SoloPanelPage', (ctx) => {
        ctx.setup(() => {
            ctx.mount();
            ctx.setDashboard({ uid: '1', panels: [{ id: 1, type: 'graph', title: 'Panel 1' }] });
            ctx.setSecondaryDashboard({ uid: '2', panels: [{ id: 1, type: 'graph', title: 'Panel 2' }] });
        });
        it('Should show other graph', () => {
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