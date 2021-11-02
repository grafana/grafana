import { __assign } from "tslib";
import React from 'react';
import { ReplaySubject } from 'rxjs';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import { act, render, screen } from '@testing-library/react';
import { EventBusSrv, getDefaultTimeRange, LoadingState } from '@grafana/data';
import { PanelChrome } from './PanelChrome';
import { setTimeSrv } from '../services/TimeSrv';
jest.mock('app/core/profiler', function () { return ({
    profiler: {
        renderingCompleted: jest.fn(),
    },
}); });
function setupTestContext(options) {
    var mockStore = configureMockStore();
    var store = mockStore({ dashboard: { panels: [] } });
    var subject = new ReplaySubject();
    var panelQueryRunner = {
        getData: function () { return subject; },
        run: function () {
            subject.next({ state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() });
        },
    };
    var timeSrv = {
        timeRange: jest.fn(),
    };
    setTimeSrv(timeSrv);
    var defaults = {
        panel: {
            id: 123,
            hasTitle: jest.fn(),
            replaceVariables: jest.fn(),
            events: { subscribe: jest.fn() },
            getQueryRunner: function () { return panelQueryRunner; },
            getOptions: jest.fn(),
            getDisplayTitle: jest.fn(),
        },
        dashboard: {
            panelInitialized: jest.fn(),
            getTimezone: function () { return 'browser'; },
            events: new EventBusSrv(),
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
        onInstanceStateChange: function () { },
    };
    var props = __assign(__assign({}, defaults), options);
    var rerender = render(React.createElement(Provider, { store: store },
        React.createElement(PanelChrome, __assign({}, props)))).rerender;
    return { rerender: rerender, props: props, subject: subject, store: store };
}
describe('PanelChrome', function () {
    describe('when the user scrolls by a panel so fast that it starts loading data but scrolls out of view', function () {
        it('then it should load the panel successfully when scrolled into view again', function () {
            var _a = setupTestContext({}), rerender = _a.rerender, props = _a.props, subject = _a.subject, store = _a.store;
            expect(screen.queryByText(/plugin panel to render/i)).not.toBeInTheDocument();
            act(function () {
                subject.next({ state: LoadingState.Loading, series: [], timeRange: getDefaultTimeRange() });
                subject.next({ state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() });
            });
            var newProps = __assign(__assign({}, props), { isInView: true });
            rerender(React.createElement(Provider, { store: store },
                React.createElement(PanelChrome, __assign({}, newProps))));
            expect(screen.getByText(/plugin panel to render/i)).toBeInTheDocument();
        });
    });
});
var TestPanelComponent = function () { return React.createElement("div", null, "Plugin Panel to Render"); };
//# sourceMappingURL=PanelChrome.test.js.map