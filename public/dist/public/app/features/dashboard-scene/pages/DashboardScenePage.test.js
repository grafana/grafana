import { __awaiter } from "tslib";
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { config, locationService, setPluginImportUtils } from '@grafana/runtime';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { setupLoadDashboardMock } from '../utils/test-utils';
import { DashboardScenePage } from './DashboardScenePage';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getDataSourceSrv: () => {
        return {
            get: jest.fn().mockResolvedValue({}),
            getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds1' }),
        };
    } })));
function setup() {
    const context = getGrafanaContextMock();
    const props = Object.assign({}, getRouteComponentProps());
    props.match.params.uid = 'd10';
    const renderResult = render(React.createElement(TestProvider, { grafanaContext: context },
        React.createElement(DashboardScenePage, Object.assign({}, props))));
    return { renderResult, context };
}
const simpleDashboard = {
    title: 'My cool dashboard',
    uid: '10d',
    panels: [
        {
            id: 1,
            type: 'custom-viz-panel',
            title: 'Panel A',
            options: {
                content: `Content A`,
            },
            gridPos: {
                x: 0,
                y: 0,
                w: 10,
                h: 10,
            },
            targets: [],
        },
        {
            id: 2,
            type: 'custom-viz-panel',
            title: 'Panel B',
            options: {
                content: `Content B`,
            },
            gridPos: {
                x: 0,
                y: 10,
                w: 10,
                h: 10,
            },
            targets: [],
        },
    ],
};
const panelPlugin = getPanelPlugin({
    skipDataQuery: true,
}, CustomVizPanel);
config.panels['custom-viz-panel'] = panelPlugin.meta;
setPluginImportUtils({
    importPanelPlugin: (id) => Promise.resolve(panelPlugin),
    getPanelPluginFromCache: (id) => undefined,
});
describe('DashboardScenePage', () => {
    beforeEach(() => {
        locationService.push('/');
        setupLoadDashboardMock({ dashboard: simpleDashboard, meta: {} });
        // hacky way because mocking autosizer does not work
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 1000 });
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 1000 });
    });
    it('Can render dashboard', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        yield waitForDashbordToRender();
        expect(yield screen.findByTitle('Panel A')).toBeInTheDocument();
        expect(yield screen.findByText('Content A')).toBeInTheDocument();
        expect(yield screen.findByTitle('Panel B')).toBeInTheDocument();
        expect(yield screen.findByText('Content B')).toBeInTheDocument();
    }));
    it('Can inspect panel', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        yield waitForDashbordToRender();
        expect(screen.queryByText('Inspect: Panel B')).not.toBeInTheDocument();
        // Wish I could use the menu here but unable t get it to open when I click the menu button
        // Somethig with Dropdown that is not working inside react-testing
        yield userEvent.click(screen.getByLabelText('Menu for panel with title Panel B'));
        const inspectLink = (yield screen.findByRole('link', { name: /Inspect/ })).getAttribute('href');
        act(() => locationService.push(inspectLink));
        // I get not implemented exception here (from navigation / js-dom).
        // Mocking window.location.assign did not help
        //await userEvent.click(await screen.findByRole('link', { name: /Inspect/ }));
        expect(yield screen.findByText('Inspect: Panel B')).toBeInTheDocument();
        act(() => locationService.partial({ inspect: null }));
        expect(screen.queryByText('Inspect: Panel B')).not.toBeInTheDocument();
    }));
    it('Can view panel in fullscreen', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        yield waitForDashbordToRender();
        expect(yield screen.findByTitle('Panel A')).toBeInTheDocument();
        act(() => locationService.partial({ viewPanel: '2' }));
        expect(screen.queryByTitle('Panel A')).not.toBeInTheDocument();
        expect(yield screen.findByTitle('Panel B')).toBeInTheDocument();
    }));
});
function CustomVizPanel(props) {
    return React.createElement("div", null, props.options.content);
}
function waitForDashbordToRender() {
    return __awaiter(this, void 0, void 0, function* () {
        expect(yield screen.findByText('Last 6 hours')).toBeInTheDocument();
        expect(yield screen.findByTitle('Panel A')).toBeInTheDocument();
    });
}
//# sourceMappingURL=DashboardScenePage.test.js.map