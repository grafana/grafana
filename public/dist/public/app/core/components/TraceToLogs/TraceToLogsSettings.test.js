import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { setDataSourceSrv } from '@grafana/runtime';
import { TraceToLogsSettings } from './TraceToLogsSettings';
const defaultOptionsOldFormat = {
    jsonData: {
        tracesToLogs: {
            datasourceUid: 'loki1_uid',
            tags: ['someTag'],
            mapTagNamesEnabled: false,
            spanStartTimeShift: '1m',
            spanEndTimeShift: '1m',
            filterByTraceID: true,
            filterBySpanID: true,
        },
    },
};
const defaultOptionsNewFormat = {
    jsonData: {
        tracesToLogsV2: {
            datasourceUid: 'loki1_uid',
            tags: [{ key: 'someTag', value: 'newName' }],
            spanStartTimeShift: '1m',
            spanEndTimeShift: '1m',
            filterByTraceID: true,
            filterBySpanID: true,
            customQuery: true,
            query: '{${__tags}}',
        },
    },
};
const lokiSettings = {
    uid: 'loki1_uid',
    name: 'loki1',
    type: 'loki',
    meta: { info: { logos: { small: '' } } },
};
describe('TraceToLogsSettings', () => {
    beforeAll(() => {
        setDataSourceSrv({
            getList() {
                return [lokiSettings];
            },
            getInstanceSettings() {
                return lokiSettings;
            },
        });
    });
    it('should render old format without error', () => {
        expect(() => render(React.createElement(TraceToLogsSettings, { options: defaultOptionsOldFormat, onOptionsChange: () => { } }))).not.toThrow();
    });
    it('should render new format without error', () => {
        expect(() => render(React.createElement(TraceToLogsSettings, { options: defaultOptionsNewFormat, onOptionsChange: () => { } }))).not.toThrow();
    });
    it('should render and transform data from old format correctly', () => {
        render(React.createElement(TraceToLogsSettings, { options: defaultOptionsOldFormat, onOptionsChange: () => { } }));
        expect(screen.getByText('someTag')).toBeInTheDocument();
        expect(screen.getByLabelText('Use custom query').checked).toBeFalsy();
        expect(screen.getByLabelText('Filter by trace ID').checked).toBeTruthy();
        expect(screen.getByLabelText('Filter by span ID').checked).toBeTruthy();
    });
    it('renders old mapped tags correctly', () => {
        const options = Object.assign(Object.assign({}, defaultOptionsOldFormat), { jsonData: Object.assign(Object.assign({}, defaultOptionsOldFormat.jsonData), { tracesToLogs: Object.assign(Object.assign({}, defaultOptionsOldFormat.jsonData.tracesToLogs), { tags: undefined, mappedTags: [{ key: 'someTag', value: 'withNewName' }], mapTagNamesEnabled: true }) }) });
        render(React.createElement(TraceToLogsSettings, { options: options, onOptionsChange: () => { } }));
        expect(screen.getByText('someTag')).toBeInTheDocument();
        expect(screen.getByText('withNewName')).toBeInTheDocument();
    });
    it('transforms old format to new on change', () => __awaiter(void 0, void 0, void 0, function* () {
        const changeMock = jest.fn();
        render(React.createElement(TraceToLogsSettings, { options: defaultOptionsOldFormat, onOptionsChange: changeMock }));
        const checkBox = screen.getByLabelText('Filter by trace ID');
        yield userEvent.click(checkBox);
        expect(changeMock.mock.calls[0]).toEqual([
            {
                jsonData: {
                    tracesToLogs: undefined,
                    tracesToLogsV2: {
                        customQuery: false,
                        datasourceUid: 'loki1_uid',
                        filterBySpanID: true,
                        filterByTraceID: false,
                        spanEndTimeShift: '1m',
                        spanStartTimeShift: '1m',
                        tags: [
                            {
                                key: 'someTag',
                            },
                        ],
                    },
                },
            },
        ]);
    }));
});
//# sourceMappingURL=TraceToLogsSettings.test.js.map