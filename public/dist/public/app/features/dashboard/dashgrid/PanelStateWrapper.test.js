import { __awaiter } from "tslib";
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import { ReplaySubject } from 'rxjs';
import { EventBusSrv, getDefaultTimeRange, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { setTimeSrv } from '../services/TimeSrv';
import { PanelModel } from '../state';
import { PanelStateWrapper } from './PanelStateWrapper';
jest.mock('app/core/profiler', () => ({
    profiler: {
        renderingCompleted: jest.fn(),
    },
}));
function setupTestContext(options) {
    const mockStore = configureMockStore();
    const store = mockStore({ dashboard: { panels: [] } });
    const subject = new ReplaySubject();
    const panelQueryRunner = {
        getData: () => subject,
        run: () => {
            subject.next({ state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() });
        },
    };
    const timeSrv = {
        timeRange: jest.fn(),
    };
    setTimeSrv(timeSrv);
    const defaults = {
        panel: new PanelModel({
            id: 123,
            hasTitle: jest.fn(),
            replaceVariables: jest.fn(),
            events: new EventBusSrv(),
            getQueryRunner: () => panelQueryRunner,
            getOptions: jest.fn(),
            getDisplayTitle: jest.fn(),
        }),
        dashboard: {
            panelInitialized: jest.fn(),
            getTimezone: () => 'browser',
            events: new EventBusSrv(),
            canAddAnnotations: jest.fn(),
            canEditAnnotations: jest.fn(),
            canDeleteAnnotations: jest.fn(),
            meta: {
                isPublic: false,
            },
        },
        plugin: {
            meta: { skipDataQuery: false },
            panel: TestPanelComponent,
        },
        isViewing: true,
        isEditing: false,
        isInView: false,
        width: 100,
        height: 100,
        onInstanceStateChange: () => { },
    };
    const props = Object.assign(Object.assign({}, defaults), options);
    const { rerender } = render(React.createElement(Provider, { store: store },
        React.createElement(PanelStateWrapper, Object.assign({}, props))));
    return { rerender, props, subject, store };
}
describe('PanelStateWrapper', () => {
    describe('when the user scrolls by a panel so fast that it starts loading data but scrolls out of view', () => {
        it('then it should load the panel successfully when scrolled into view again', () => {
            const { rerender, props, subject, store } = setupTestContext({});
            expect(screen.queryByText(/plugin panel to render/i)).not.toBeInTheDocument();
            act(() => {
                subject.next({ state: LoadingState.Loading, series: [], timeRange: getDefaultTimeRange() });
                subject.next({ state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() });
            });
            const newProps = Object.assign(Object.assign({}, props), { isInView: true });
            rerender(React.createElement(Provider, { store: store },
                React.createElement(PanelStateWrapper, Object.assign({}, newProps))));
            expect(screen.getByText(/plugin panel to render/i)).toBeInTheDocument();
        });
    });
    describe('when there are error(s)', () => {
        [
            { errors: [{ message: 'boom!' }], expectedMessage: 'boom!' },
            {
                errors: [{ message: 'boom!' }, { message: 'boom2!' }],
                expectedMessage: 'Multiple errors found. Click for more details',
            },
        ].forEach((scenario) => {
            it(`then it should show the error message: ${scenario.expectedMessage}`, () => __awaiter(void 0, void 0, void 0, function* () {
                const { rerender, props, subject, store } = setupTestContext({});
                act(() => {
                    subject.next({ state: LoadingState.Loading, series: [], timeRange: getDefaultTimeRange() });
                    subject.next({
                        state: LoadingState.Error,
                        series: [],
                        errors: scenario.errors,
                        timeRange: getDefaultTimeRange(),
                    });
                });
                const newProps = Object.assign(Object.assign({}, props), { isInView: true });
                rerender(React.createElement(Provider, { store: store },
                    React.createElement(PanelStateWrapper, Object.assign({}, newProps))));
                const button = screen.getByTestId(selectors.components.Panels.Panel.status('error'));
                expect(button).toBeInTheDocument();
                yield act(() => __awaiter(void 0, void 0, void 0, function* () {
                    fireEvent.focus(button);
                }));
                expect(yield screen.findByText(scenario.expectedMessage)).toBeInTheDocument();
            }));
        });
    });
});
const TestPanelComponent = () => React.createElement("div", null, "Plugin Panel to Render");
//# sourceMappingURL=PanelStateWrapper.test.js.map