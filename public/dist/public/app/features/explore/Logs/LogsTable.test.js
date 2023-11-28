import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { FieldType, LogsSortOrder, standardTransformersRegistry, toUtc } from '@grafana/data';
import { organizeFieldsTransformer } from '@grafana/data/src/transformations/transformers/organize';
import { config } from '@grafana/runtime';
import { extractFieldsTransformer } from 'app/features/transformers/extractFields/extractFields';
import { LogsTable } from './LogsTable';
jest.mock('@grafana/runtime', () => {
    const actual = jest.requireActual('@grafana/runtime');
    return Object.assign(Object.assign({}, actual), { getTemplateSrv: () => ({
            replace: (val) => (val ? val.replace('$input', '10').replace('$window', '10s') : val),
        }) });
});
describe('LogsTable', () => {
    beforeAll(() => {
        const transformers = [extractFieldsTransformer, organizeFieldsTransformer];
        standardTransformersRegistry.setInit(() => {
            return transformers.map((t) => {
                return {
                    id: t.id,
                    aliasIds: t.aliasIds,
                    name: t.name,
                    transformation: t,
                    description: t.description,
                    editor: () => null,
                };
            });
        });
    });
    const getComponent = (partialProps, logs) => {
        const testDataFrame = {
            fields: [
                {
                    config: {},
                    name: 'Time',
                    type: FieldType.time,
                    values: ['2019-01-01 10:00:00', '2019-01-01 11:00:00', '2019-01-01 12:00:00'],
                },
                {
                    config: {},
                    name: 'line',
                    type: FieldType.string,
                    values: ['log message 1', 'log message 2', 'log message 3'],
                },
                {
                    config: {},
                    name: 'tsNs',
                    type: FieldType.string,
                    values: ['ts1', 'ts2', 'ts3'],
                },
                {
                    config: {},
                    name: 'labels',
                    type: FieldType.other,
                    typeInfo: {
                        frame: 'json.RawMessage',
                    },
                    values: ['{"foo":"bar"}', '{"foo":"bar"}', '{"foo":"bar"}'],
                },
            ],
            length: 3,
        };
        return (React.createElement(LogsTable, Object.assign({ logsSortOrder: LogsSortOrder.Descending, splitOpen: () => undefined, timeZone: 'utc', width: 50, range: {
                from: toUtc('2019-01-01 10:00:00'),
                to: toUtc('2019-01-01 16:00:00'),
                raw: { from: 'now-1h', to: 'now' },
            }, logsFrames: [logs !== null && logs !== void 0 ? logs : testDataFrame] }, partialProps)));
    };
    const setup = (partialProps, logs) => {
        return render(getComponent(partialProps, logs));
    };
    let originalVisualisationTypeValue = config.featureToggles.logsExploreTableVisualisation;
    beforeAll(() => {
        originalVisualisationTypeValue = config.featureToggles.logsExploreTableVisualisation;
        config.featureToggles.logsExploreTableVisualisation = true;
    });
    afterAll(() => {
        config.featureToggles.logsExploreTableVisualisation = originalVisualisationTypeValue;
    });
    it('should render 4 table rows', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        yield waitFor(() => {
            const rows = screen.getAllByRole('row');
            // tableFrame has 3 rows + 1 header row
            expect(rows.length).toBe(4);
        });
    }));
    it('should render 4 table rows', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        yield waitFor(() => {
            const rows = screen.getAllByRole('row');
            // tableFrame has 3 rows + 1 header row
            expect(rows.length).toBe(4);
        });
    }));
    it('should render extracted labels as columns', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        yield waitFor(() => {
            const columns = screen.getAllByRole('columnheader');
            expect(columns[0].textContent).toContain('Time');
            expect(columns[1].textContent).toContain('line');
            expect(columns[2].textContent).toContain('foo');
        });
    }));
    it('should not render `tsNs`', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        yield waitFor(() => {
            const columns = screen.queryAllByRole('columnheader', { name: 'tsNs' });
            expect(columns.length).toBe(0);
        });
    }));
    it('should render a datalink for each row', () => __awaiter(void 0, void 0, void 0, function* () {
        render(getComponent({}, {
            fields: [
                {
                    config: {},
                    name: 'Time',
                    type: FieldType.time,
                    values: ['2019-01-01 10:00:00', '2019-01-01 11:00:00', '2019-01-01 12:00:00'],
                },
                {
                    config: {},
                    name: 'line',
                    type: FieldType.string,
                    values: ['log message 1', 'log message 2', 'log message 3'],
                },
                {
                    config: {
                        links: [
                            {
                                url: 'http://example.com',
                                title: 'foo',
                            },
                        ],
                    },
                    name: 'link',
                    type: FieldType.string,
                    values: ['ts1', 'ts2', 'ts3'],
                },
            ],
            length: 3,
        }));
        yield waitFor(() => {
            const links = screen.getAllByRole('link');
            expect(links.length).toBe(3);
        });
    }));
});
//# sourceMappingURL=LogsTable.test.js.map