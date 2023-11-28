import { __awaiter } from "tslib";
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import { ReplaySubject } from 'rxjs';
import { TimeSrvStub } from 'test/specs/helpers';
import { dateTime, EventBusSrv, getDefaultTimeRange, LoadingState, } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getTimeSrv, setTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { PanelModel } from '../../state';
import { createDashboardModelFixture } from '../../state/__fixtures__/dashboardFixtures';
import { PanelEditorTableView } from './PanelEditorTableView';
jest.mock('../../utils/panel', () => ({
    applyPanelTimeOverrides: jest.fn((panel, timeRange) => (Object.assign({}, timeRange))),
}));
jest.mock('app/features/panel/components/PanelRenderer', () => ({
    PanelRenderer: jest.fn(() => React.createElement("div", null, "PanelRenderer Mock")),
}));
function setupTestContext(options = {}) {
    const mockStore = configureMockStore();
    const subject = new ReplaySubject();
    const panelQueryRunner = {
        getData: () => subject,
        run: () => {
            subject.next({ state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() });
        },
    };
    const defaults = {
        panel: new PanelModel({
            id: 123,
            hasTitle: jest.fn(),
            replaceVariables: jest.fn(),
            events: new EventBusSrv(),
            getQueryRunner: () => panelQueryRunner,
            getOptions: jest.fn(),
            getDisplayTitle: jest.fn(),
            runAllPanelQueries: jest.fn(),
        }),
        dashboard: createDashboardModelFixture({
            id: 1,
            uid: 'super-unique-id',
            // panelInitialized: jest.fn(),
            // events: new EventBusSrv(),
            panels: [],
        }),
        plugin: {
            meta: { skipDataQuery: false },
            panel: TestPanelComponent,
        },
        isViewing: false,
        isEditing: true,
        isInView: false,
        width: 100,
        height: 100,
        onInstanceStateChange: () => { },
    };
    // Set up the mock store with the defaults
    const store = mockStore({ dashboard: defaults.dashboard });
    const timeSrv = getTimeSrv();
    const props = Object.assign(Object.assign({}, defaults), options);
    const { rerender } = render(React.createElement(Provider, { store: store },
        React.createElement(PanelEditorTableView, Object.assign({}, props))));
    return { rerender, props, subject, store, timeSrv };
}
describe('PanelEditorTableView', () => {
    beforeAll(() => {
        // Mock the timeSrv singleton
        const timeSrvMock2 = new TimeSrvStub();
        setTimeSrv(timeSrvMock2);
    });
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('should render', () => __awaiter(void 0, void 0, void 0, function* () {
        const { rerender, props, subject, store } = setupTestContext({});
        // only render the panel when loading is done
        act(() => {
            subject.next({ state: LoadingState.Loading, series: [], timeRange: getDefaultTimeRange() });
            subject.next({ state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() });
        });
        const newProps = Object.assign(Object.assign({}, props), { isInView: true });
        rerender(React.createElement(Provider, { store: store },
            React.createElement(PanelEditorTableView, Object.assign({}, newProps))));
        expect(screen.getByText(/PanelRenderer Mock/i)).toBeInTheDocument();
    }));
    it('should run all panel queries if time changes', () => __awaiter(void 0, void 0, void 0, function* () {
        const { rerender, props, subject, store, timeSrv } = setupTestContext({});
        const timeRangeUpdated = {
            from: dateTime([2019, 1, 11, 12, 0]),
            to: dateTime([2019, 1, 11, 18, 0]),
        };
        // only render the panel when loading is done
        act(() => {
            subject.next({ state: LoadingState.Loading, series: [], timeRange: getDefaultTimeRange() });
            subject.next({ state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() });
        });
        const newProps = Object.assign(Object.assign({}, props), { isInView: true });
        rerender(React.createElement(Provider, { store: store },
            React.createElement(PanelEditorTableView, Object.assign({}, newProps))));
        expect(screen.getByText(/PanelRenderer Mock/i)).toBeInTheDocument();
        // updating the global time range
        act(() => {
            timeSrv.setTime(timeRangeUpdated);
            props.panel.refresh();
        });
        // panel queries should have the updated time range
        expect(props.panel.runAllPanelQueries).toHaveBeenNthCalledWith(1, {
            dashboardTimezone: '',
            dashboardUID: props.dashboard.uid,
            timeData: timeRangeUpdated,
            width: 100,
        });
        // update global time  second time
        const timeRangeUpdated2 = {
            from: dateTime([2018, 1, 11, 12, 0]),
            to: dateTime([2018, 1, 11, 18, 0]),
        };
        act(() => {
            timeSrv.setTime(timeRangeUpdated2);
            props.panel.refresh();
        });
        // panel queries should have the updated time range
        expect(props.panel.runAllPanelQueries).toHaveBeenLastCalledWith({
            dashboardTimezone: '',
            dashboardUID: props.dashboard.uid,
            timeData: timeRangeUpdated2,
            width: 100,
        });
    }));
    it('should render an error', () => __awaiter(void 0, void 0, void 0, function* () {
        const { rerender, props, subject, store } = setupTestContext({});
        // only render the panel when loading is done
        act(() => {
            subject.next({ state: LoadingState.Loading, series: [], timeRange: getDefaultTimeRange() });
            subject.next({
                state: LoadingState.Error,
                series: [],
                errors: [{ message: 'boom!' }],
                timeRange: getDefaultTimeRange(),
            });
        });
        const newProps = Object.assign(Object.assign({}, props), { isInView: true });
        rerender(React.createElement(Provider, { store: store },
            React.createElement(PanelEditorTableView, Object.assign({}, newProps))));
        const button = screen.getByRole('button', { name: selectors.components.Panels.Panel.headerCornerInfo('error') });
        expect(button).toBeInTheDocument();
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            fireEvent.focus(button);
        }));
        expect(yield screen.findByText('boom!')).toBeInTheDocument();
    }));
    it('should render a description for multiple errors', () => __awaiter(void 0, void 0, void 0, function* () {
        const { rerender, props, subject, store } = setupTestContext({});
        // only render the panel when loading is done
        act(() => {
            subject.next({ state: LoadingState.Loading, series: [], timeRange: getDefaultTimeRange() });
            subject.next({
                state: LoadingState.Error,
                series: [],
                errors: [{ message: 'boom 1!' }, { message: 'boom 2!' }],
                timeRange: getDefaultTimeRange(),
            });
        });
        const newProps = Object.assign(Object.assign({}, props), { isInView: true });
        rerender(React.createElement(Provider, { store: store },
            React.createElement(PanelEditorTableView, Object.assign({}, newProps))));
        const button = screen.getByRole('button', { name: selectors.components.Panels.Panel.headerCornerInfo('error') });
        expect(button).toBeInTheDocument();
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            fireEvent.focus(button);
        }));
        expect(yield screen.findByText('Multiple errors found. Click for more details')).toBeInTheDocument();
    }));
});
const TestPanelComponent = () => React.createElement("div", null, "Plugin Panel to Render");
//# sourceMappingURL=PanelEditorTableView.test.js.map