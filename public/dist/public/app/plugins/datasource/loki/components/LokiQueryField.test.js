import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { dateTime } from '@grafana/data';
import { createLokiDatasource } from '../mocks';
import { LokiQueryField } from './LokiQueryField';
describe('LokiQueryField', () => {
    let props;
    beforeEach(() => {
        props = {
            datasource: createLokiDatasource(),
            range: {
                from: dateTime([2021, 1, 11, 12, 0, 0]),
                to: dateTime([2021, 1, 11, 18, 0, 0]),
                raw: {
                    from: 'now-1h',
                    to: 'now',
                },
            },
            query: { expr: '', refId: '' },
            onRunQuery: () => { },
            onChange: () => { },
            history: [],
        };
        jest.spyOn(props.datasource.languageProvider, 'start').mockResolvedValue([]);
        jest.spyOn(props.datasource.languageProvider, 'fetchLabels').mockResolvedValue(['label1']);
    });
    it('refreshes metrics when time range changes over 1 minute', () => __awaiter(void 0, void 0, void 0, function* () {
        const { rerender } = render(React.createElement(LokiQueryField, Object.assign({}, props)));
        expect(yield screen.findByText('Loading...')).toBeInTheDocument();
        expect(props.datasource.languageProvider.fetchLabels).not.toHaveBeenCalled();
        // 2 minutes difference over the initial time
        const newRange = {
            from: dateTime([2021, 1, 11, 12, 2, 0]),
            to: dateTime([2021, 1, 11, 18, 2, 0]),
            raw: {
                from: 'now-1h',
                to: 'now',
            },
        };
        rerender(React.createElement(LokiQueryField, Object.assign({}, props, { range: newRange })));
        expect(props.datasource.languageProvider.fetchLabels).toHaveBeenCalledTimes(1);
    }));
    it('does not refreshes metrics when time range change by less than 1 minute', () => __awaiter(void 0, void 0, void 0, function* () {
        const { rerender } = render(React.createElement(LokiQueryField, Object.assign({}, props)));
        expect(yield screen.findByText('Loading...')).toBeInTheDocument();
        expect(props.datasource.languageProvider.fetchLabels).not.toHaveBeenCalled();
        // 20 seconds difference over the initial time
        const newRange = {
            from: dateTime([2021, 1, 11, 12, 0, 20]),
            to: dateTime([2021, 1, 11, 18, 0, 20]),
            raw: {
                from: 'now-1h',
                to: 'now',
            },
        };
        rerender(React.createElement(LokiQueryField, Object.assign({}, props, { range: newRange })));
        expect(props.datasource.languageProvider.fetchLabels).not.toHaveBeenCalled();
    }));
});
//# sourceMappingURL=LokiQueryField.test.js.map