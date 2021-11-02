import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { act } from 'react-dom/test-utils';
import PromExploreQueryEditor from './PromExploreQueryEditor';
import { LoadingState, toUtc } from '@grafana/data';
var setup = function (renderMethod, propOverrides) {
    var datasourceMock = {
        languageProvider: {
            syntax: function () { },
            getLabelKeys: function () { return []; },
            metrics: [],
        },
    };
    var datasource = datasourceMock;
    var onRunQuery = jest.fn();
    var onChange = jest.fn();
    var query = { expr: '', refId: 'A', interval: '1s' };
    var range = {
        from: toUtc('2020-01-01', 'YYYY-MM-DD'),
        to: toUtc('2020-01-02', 'YYYY-MM-DD'),
        raw: {
            from: toUtc('2020-01-01', 'YYYY-MM-DD'),
            to: toUtc('2020-01-02', 'YYYY-MM-DD'),
        },
    };
    var data = {
        state: LoadingState.NotStarted,
        series: [],
        request: {
            requestId: '1',
            dashboardId: 1,
            intervalMs: 1000,
            interval: '1s',
            panelId: 1,
            range: {
                from: toUtc('2020-01-01', 'YYYY-MM-DD'),
                to: toUtc('2020-01-02', 'YYYY-MM-DD'),
                raw: {
                    from: toUtc('2020-01-01', 'YYYY-MM-DD'),
                    to: toUtc('2020-01-02', 'YYYY-MM-DD'),
                },
            },
            scopedVars: {},
            targets: [],
            timezone: 'GMT',
            app: 'Grafana',
            startTime: 0,
        },
        timeRange: {
            from: toUtc('2020-01-01', 'YYYY-MM-DD'),
            to: toUtc('2020-01-02', 'YYYY-MM-DD'),
            raw: {
                from: toUtc('2020-01-01', 'YYYY-MM-DD'),
                to: toUtc('2020-01-02', 'YYYY-MM-DD'),
            },
        },
    };
    var history = [];
    var exploreMode = 'Metrics';
    var props = {
        query: query,
        data: data,
        range: range,
        datasource: datasource,
        exploreMode: exploreMode,
        history: history,
        onChange: onChange,
        onRunQuery: onRunQuery,
    };
    Object.assign(props, propOverrides);
    return renderMethod(React.createElement(PromExploreQueryEditor, __assign({}, props)));
};
describe('PromExploreQueryEditor', function () {
    var originalGetSelection;
    beforeAll(function () {
        originalGetSelection = window.getSelection;
        window.getSelection = function () { return null; };
    });
    afterAll(function () {
        window.getSelection = originalGetSelection;
    });
    it('should render component', function () {
        var wrapper = setup(shallow);
        expect(wrapper).toMatchSnapshot();
    });
    it('should render PromQueryField with ExtraFieldElement', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                // @ts-ignore strict null errpr TS2345: Argument of type '() => Promise<void>' is not assignable to parameter of type '() => void | undefined'.
                return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                        var wrapper;
                        return __generator(this, function (_a) {
                            wrapper = setup(shallow);
                            expect(wrapper.html()).toContain('aria-label="Prometheus extra field"');
                            return [2 /*return*/];
                        });
                    }); })];
                case 1:
                    // @ts-ignore strict null errpr TS2345: Argument of type '() => Promise<void>' is not assignable to parameter of type '() => void | undefined'.
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=PromExploreQueryEditor.test.js.map