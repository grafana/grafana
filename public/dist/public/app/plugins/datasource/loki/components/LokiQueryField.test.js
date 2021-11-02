import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { render } from '@testing-library/react';
import { LokiQueryField } from './LokiQueryField';
import { dateTime } from '@grafana/data';
var defaultProps = {
    datasource: {
        languageProvider: {
            start: function () { return Promise.resolve(['label1']); },
            fetchLabels: Promise.resolve(['label1']),
            getSyntax: function () { },
            getLabelKeys: function () { return ['label1']; },
            getLabelValues: function () { return ['value1']; },
        },
        getInitHints: function () { return []; },
    },
    range: {
        from: dateTime([2021, 1, 11, 12, 0, 0]),
        to: dateTime([2021, 1, 11, 18, 0, 0]),
        raw: {
            from: 'now-1h',
            to: 'now',
        },
    },
    query: { expr: '', refId: '' },
    onRunQuery: function () { },
    onChange: function () { },
    history: [],
};
describe('LokiQueryField', function () {
    it('refreshes metrics when time range changes over 1 minute', function () { return __awaiter(void 0, void 0, void 0, function () {
        var fetchLabelsMock, props, rerender, newRange;
        return __generator(this, function (_a) {
            fetchLabelsMock = jest.fn();
            props = defaultProps;
            props.datasource.languageProvider.fetchLabels = fetchLabelsMock;
            rerender = render(React.createElement(LokiQueryField, __assign({}, props))).rerender;
            expect(fetchLabelsMock).not.toHaveBeenCalled();
            newRange = {
                from: dateTime([2021, 1, 11, 12, 2, 0]),
                to: dateTime([2021, 1, 11, 18, 2, 0]),
                raw: {
                    from: 'now-1h',
                    to: 'now',
                },
            };
            rerender(React.createElement(LokiQueryField, __assign({}, props, { range: newRange })));
            expect(fetchLabelsMock).toHaveBeenCalledTimes(1);
            return [2 /*return*/];
        });
    }); });
    it('does not refreshes metrics when time range change by less than 1 minute', function () { return __awaiter(void 0, void 0, void 0, function () {
        var fetchLabelsMock, props, rerender, newRange;
        return __generator(this, function (_a) {
            fetchLabelsMock = jest.fn();
            props = defaultProps;
            props.datasource.languageProvider.fetchLabels = fetchLabelsMock;
            rerender = render(React.createElement(LokiQueryField, __assign({}, props))).rerender;
            expect(fetchLabelsMock).not.toHaveBeenCalled();
            newRange = {
                from: dateTime([2021, 1, 11, 12, 0, 20]),
                to: dateTime([2021, 1, 11, 18, 0, 20]),
                raw: {
                    from: 'now-1h',
                    to: 'now',
                },
            };
            rerender(React.createElement(LokiQueryField, __assign({}, props, { range: newRange })));
            expect(fetchLabelsMock).not.toHaveBeenCalled();
            return [2 /*return*/];
        });
    }); });
});
//# sourceMappingURL=LokiQueryField.test.js.map