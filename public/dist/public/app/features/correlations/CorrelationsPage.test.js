import { __awaiter } from "tslib";
import { render, waitFor, screen, fireEvent, within, getByRole } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { merge, uniqueId } from 'lodash';
import React from 'react';
import { openMenu } from 'react-select-event';
import { Observable } from 'rxjs';
import { TestProvider } from 'test/helpers/TestProvider';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { SupportedTransformationType } from '@grafana/data';
import { setDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { mockDataSource, MockDataSourceSrv } from '../alerting/unified/mocks';
import CorrelationsPage from './CorrelationsPage';
import { createCreateCorrelationResponse, createFetchCorrelationsError, createFetchCorrelationsResponse, createRemoveCorrelationResponse, createUpdateCorrelationResponse, } from './__mocks__/useCorrelations.mocks';
const renderWithContext = (datasources = {}, correlations = []) => __awaiter(void 0, void 0, void 0, function* () {
    const backend = {
        delete: (url) => __awaiter(void 0, void 0, void 0, function* () {
            const matches = url.match(/^\/api\/datasources\/uid\/(?<dsUid>[a-zA-Z0-9]+)\/correlations\/(?<correlationUid>[a-zA-Z0-9]+)$/);
            if (matches === null || matches === void 0 ? void 0 : matches.groups) {
                const { dsUid, correlationUid } = matches.groups;
                correlations = correlations.filter((c) => c.uid !== correlationUid || c.sourceUID !== dsUid);
                return createRemoveCorrelationResponse();
            }
            throw createFetchCorrelationsError();
        }),
        post: (url, data) => __awaiter(void 0, void 0, void 0, function* () {
            const matches = url.match(/^\/api\/datasources\/uid\/(?<sourceUID>[a-zA-Z0-9]+)\/correlations$/);
            if (matches === null || matches === void 0 ? void 0 : matches.groups) {
                const { sourceUID } = matches.groups;
                const correlation = Object.assign(Object.assign({ sourceUID }, data), { uid: uniqueId(), provisioned: false });
                correlations.push(correlation);
                return createCreateCorrelationResponse(correlation);
            }
            throw createFetchCorrelationsError();
        }),
        patch: (url, data) => __awaiter(void 0, void 0, void 0, function* () {
            const matches = url.match(/^\/api\/datasources\/uid\/(?<sourceUID>[a-zA-Z0-9]+)\/correlations\/(?<correlationUid>[a-zA-Z0-9]+)$/);
            if (matches === null || matches === void 0 ? void 0 : matches.groups) {
                const { sourceUID, correlationUid } = matches.groups;
                correlations = correlations.map((c) => {
                    if (c.uid === correlationUid && sourceUID === c.sourceUID) {
                        return Object.assign(Object.assign({}, c), data);
                    }
                    return c;
                });
                return createUpdateCorrelationResponse(Object.assign(Object.assign({ sourceUID }, data), { uid: uniqueId(), provisioned: false }));
            }
            throw createFetchCorrelationsError();
        }),
        fetch: (options) => {
            return new Observable((s) => {
                s.next(merge(createFetchCorrelationsResponse({
                    url: options.url,
                    data: { correlations, page: 1, limit: 5, totalCount: 0 },
                })));
                s.complete();
            });
        },
    };
    const grafanaContext = getGrafanaContextMock({ backend });
    const dsServer = new MockDataSourceSrv(datasources);
    dsServer.get = (name) => {
        const dsApi = new MockDataSourceApi(name);
        dsApi.components = {
            QueryEditor: () => React.createElement(React.Fragment, null,
                name,
                " query editor"),
        };
        return Promise.resolve(dsApi);
    };
    setDataSourceSrv(dsServer);
    const renderResult = render(React.createElement(TestProvider, { store: configureStore({}), grafanaContext: grafanaContext },
        React.createElement(CorrelationsPage, null)), {
        queries: {
            /**
             * Gets all the rows in the table having the given text in the given column
             */
            queryRowsByCellValue: (container, columnName, textValue) => {
                const table = within(container).getByRole('table');
                const headers = within(table).getAllByRole('columnheader');
                const headerIndex = headers.findIndex((h) => {
                    return within(h).queryByText(columnName);
                });
                // the first rowgroup is the header
                const tableBody = within(table).getAllByRole('rowgroup')[1];
                return within(tableBody)
                    .getAllByRole('row')
                    .filter((row) => {
                    const rowCells = within(row).getAllByRole('cell');
                    const cell = rowCells[headerIndex];
                    return within(cell).queryByText(textValue);
                });
            },
            /**
             * Gets all the cells in the table for the given column name
             */
            queryCellsByColumnName: (container, columnName) => {
                const table = within(container).getByRole('table');
                const headers = within(table).getAllByRole('columnheader');
                const headerIndex = headers.findIndex((h) => {
                    return within(h).queryByText(columnName);
                });
                const tbody = table.querySelector('tbody');
                if (!tbody) {
                    return [];
                }
                return within(tbody)
                    .getAllByRole('row')
                    .map((r) => {
                    const cells = within(r).getAllByRole('cell');
                    return cells[headerIndex];
                });
            },
            /**
             * Gets the table header cell matching the given name
             */
            getHeaderByName: (container, columnName) => {
                const table = within(container).getByRole('table');
                const headers = within(table).getAllByRole('columnheader');
                const header = headers.find((h) => {
                    return within(h).queryByText(columnName);
                });
                if (!header) {
                    throw new Error(`Could not find header with name ${columnName}`);
                }
                return header;
            },
        },
    });
    yield waitFor(() => {
        expect(screen.queryByText('Loading')).not.toBeInTheDocument();
    });
    return renderResult;
});
jest.mock('app/core/services/context_srv');
const mocks = {
    contextSrv: jest.mocked(contextSrv),
    reportInteraction: jest.fn(),
};
jest.mock('@grafana/runtime', () => {
    const runtime = jest.requireActual('@grafana/runtime');
    return Object.assign(Object.assign({}, runtime), { reportInteraction: (...args) => {
            mocks.reportInteraction(...args);
        } });
});
beforeAll(() => {
    mocks.contextSrv.hasPermission.mockImplementation(() => true);
});
afterAll(() => {
    jest.restoreAllMocks();
});
describe('CorrelationsPage', () => {
    describe('With no correlations', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            yield renderWithContext({
                loki: mockDataSource({
                    uid: 'loki',
                    name: 'loki',
                    readOnly: false,
                    jsonData: {},
                    access: 'direct',
                    type: 'datasource',
                }, { logs: true }),
                prometheus: mockDataSource({
                    uid: 'prometheus',
                    name: 'prometheus',
                    readOnly: false,
                    jsonData: {},
                    access: 'direct',
                    type: 'datasource',
                }, { metrics: true }),
            });
        }));
        afterEach(() => {
            mocks.reportInteraction.mockClear();
        });
        it('shows the first page of the wizard', () => __awaiter(void 0, void 0, void 0, function* () {
            const CTAButton = yield screen.findByRole('button', { name: /add correlation/i });
            expect(CTAButton).toBeInTheDocument();
            // insert form should not be present
            expect(screen.queryByRole('button', { name: /next$/i })).not.toBeInTheDocument();
            // "add new" button is the button on the top of the page, not visible when the CTA is rendered
            expect(screen.queryByRole('button', { name: /add new$/i })).not.toBeInTheDocument();
            // there's no table in the page
            expect(screen.queryByRole('table')).not.toBeInTheDocument();
            yield userEvent.click(CTAButton);
            // form's next button
            expect(yield screen.findByRole('button', { name: /next$/i })).toBeInTheDocument();
        }));
        it('correctly adds first correlation', () => __awaiter(void 0, void 0, void 0, function* () {
            const CTAButton = yield screen.findByRole('button', { name: /add correlation/i });
            expect(CTAButton).toBeInTheDocument();
            // there's no table in the page, as we are adding the first correlation
            expect(screen.queryByRole('table')).not.toBeInTheDocument();
            yield userEvent.click(CTAButton);
            // step 1: label and description
            yield userEvent.clear(screen.getByRole('textbox', { name: /label/i }));
            yield userEvent.type(screen.getByRole('textbox', { name: /label/i }), 'A Label');
            yield userEvent.clear(screen.getByRole('textbox', { name: /description/i }));
            yield userEvent.type(screen.getByRole('textbox', { name: /description/i }), 'A Description');
            yield userEvent.click(yield screen.findByRole('button', { name: /next$/i }));
            // step 2:
            // set target datasource picker value
            fireEvent.keyDown(screen.getByLabelText(/^target/i), { keyCode: 40 });
            yield userEvent.click(screen.getByText('prometheus'));
            yield userEvent.click(yield screen.findByRole('button', { name: /next$/i }));
            // step 3:
            // set source datasource picker value
            fireEvent.keyDown(screen.getByLabelText(/^source/i), { keyCode: 40 });
            yield userEvent.click(screen.getByText('loki'));
            yield userEvent.click(yield screen.findByRole('button', { name: /add$/i }));
            yield userEvent.clear(screen.getByRole('textbox', { name: /results field/i }));
            yield userEvent.type(screen.getByRole('textbox', { name: /results field/i }), 'Line');
            // add transformation
            yield userEvent.click(screen.getByRole('button', { name: /add transformation/i }));
            const typeFilterSelect = screen.getAllByLabelText('Type');
            openMenu(typeFilterSelect[0]);
            yield userEvent.click(screen.getByText('Regular expression'));
            yield userEvent.type(screen.getByLabelText(/expression/i), 'test expression');
            yield userEvent.click(yield screen.findByRole('button', { name: /add$/i }));
            expect(mocks.reportInteraction).toHaveBeenLastCalledWith('grafana_correlations_added');
            // the table showing correlations should have appeared
            expect(yield screen.findByRole('table')).toBeInTheDocument();
        }));
    });
    describe('With correlations', () => {
        afterEach(() => {
            mocks.reportInteraction.mockClear();
        });
        let queryRowsByCellValue;
        let getHeaderByName;
        let queryCellsByColumnName;
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            const renderResult = yield renderWithContext({
                loki: mockDataSource({
                    uid: 'loki',
                    name: 'loki',
                    readOnly: false,
                    jsonData: {},
                    access: 'direct',
                    type: 'datasource',
                }, {
                    logs: true,
                }),
                prometheus: mockDataSource({
                    uid: 'prometheus',
                    name: 'prometheus',
                    readOnly: false,
                    jsonData: {},
                    access: 'direct',
                    type: 'datasource',
                }, {
                    metrics: true,
                }),
                elastic: mockDataSource({
                    uid: 'elastic',
                    name: 'elastic',
                    readOnly: false,
                    jsonData: {},
                    access: 'direct',
                    type: 'datasource',
                }, {
                    metrics: true,
                    logs: true,
                }),
            }, [
                {
                    sourceUID: 'loki',
                    targetUID: 'loki',
                    uid: '1',
                    label: 'Some label',
                    provisioned: false,
                    config: {
                        field: 'line',
                        target: {},
                        type: 'query',
                        transformations: [
                            { type: SupportedTransformationType.Regex, expression: 'url=http[s]?://(S*)', mapValue: 'path' },
                        ],
                    },
                },
                {
                    sourceUID: 'prometheus',
                    targetUID: 'loki',
                    uid: '2',
                    label: 'Prometheus to Loki',
                    config: { field: 'label', target: {}, type: 'query' },
                    provisioned: false,
                },
            ]);
            queryRowsByCellValue = renderResult.queryRowsByCellValue;
            queryCellsByColumnName = renderResult.queryCellsByColumnName;
            getHeaderByName = renderResult.getHeaderByName;
        }));
        it('shows a table with correlations', () => __awaiter(void 0, void 0, void 0, function* () {
            expect(yield screen.findByRole('table')).toBeInTheDocument();
        }));
        it('correctly sorts by source', () => __awaiter(void 0, void 0, void 0, function* () {
            // wait for table to appear
            yield screen.findByRole('table');
            const sourceHeader = getByRole(getHeaderByName('Source'), 'button');
            yield userEvent.click(sourceHeader);
            let cells = queryCellsByColumnName('Source');
            cells.forEach((cell, i, allCells) => {
                var _a;
                const prevCell = allCells[i - 1];
                if (prevCell && prevCell.textContent) {
                    expect((_a = cell.textContent) === null || _a === void 0 ? void 0 : _a.localeCompare(prevCell.textContent)).toBeGreaterThanOrEqual(0);
                }
            });
            yield userEvent.click(sourceHeader);
            cells = queryCellsByColumnName('Source');
            cells.forEach((cell, i, allCells) => {
                var _a;
                const prevCell = allCells[i - 1];
                if (prevCell && prevCell.textContent) {
                    expect((_a = cell.textContent) === null || _a === void 0 ? void 0 : _a.localeCompare(prevCell.textContent)).toBeLessThanOrEqual(0);
                }
            });
        }));
        it('correctly adds new correlation', () => __awaiter(void 0, void 0, void 0, function* () {
            const addNewButton = yield screen.findByRole('button', { name: /add new/i });
            expect(addNewButton).toBeInTheDocument();
            yield userEvent.click(addNewButton);
            // step 1:
            yield userEvent.clear(screen.getByRole('textbox', { name: /label/i }));
            yield userEvent.type(screen.getByRole('textbox', { name: /label/i }), 'A Label');
            yield userEvent.clear(screen.getByRole('textbox', { name: /description/i }));
            yield userEvent.type(screen.getByRole('textbox', { name: /description/i }), 'A Description');
            yield userEvent.click(yield screen.findByRole('button', { name: /next$/i }));
            // step 2:
            // set target datasource picker value
            fireEvent.keyDown(screen.getByLabelText(/^target/i), { keyCode: 40 });
            yield userEvent.click(screen.getByText('elastic'));
            yield userEvent.click(yield screen.findByRole('button', { name: /next$/i }));
            // step 3:
            // set source datasource picker value
            fireEvent.keyDown(screen.getByLabelText(/^source/i), { keyCode: 40 });
            yield userEvent.click(within(screen.getByLabelText('Select options menu')).getByText('prometheus'));
            yield userEvent.clear(screen.getByRole('textbox', { name: /results field/i }));
            yield userEvent.type(screen.getByRole('textbox', { name: /results field/i }), 'Line');
            yield userEvent.click(screen.getByRole('button', { name: /add$/i }));
            expect(mocks.reportInteraction).toHaveBeenLastCalledWith('grafana_correlations_added');
            // the table showing correlations should have appeared
            expect(yield screen.findByRole('table')).toBeInTheDocument();
        }));
        it('correctly closes the form when clicking on the close icon', () => __awaiter(void 0, void 0, void 0, function* () {
            const addNewButton = yield screen.findByRole('button', { name: /add new/i });
            expect(addNewButton).toBeInTheDocument();
            yield userEvent.click(addNewButton);
            yield userEvent.click(screen.getByRole('button', { name: /close$/i }));
            expect(screen.queryByRole('button', { name: /add$/i })).not.toBeInTheDocument();
        }));
        it('correctly deletes correlations', () => __awaiter(void 0, void 0, void 0, function* () {
            // A row with the correlation should exist
            expect(yield screen.findByRole('cell', { name: /some label/i })).toBeInTheDocument();
            const tableRows = queryRowsByCellValue('Source', 'loki');
            const deleteButton = within(tableRows[0]).getByRole('button', { name: /delete correlation/i });
            expect(deleteButton).toBeInTheDocument();
            yield userEvent.click(deleteButton);
            const confirmButton = within(tableRows[0]).getByRole('button', { name: /delete$/i });
            expect(confirmButton).toBeInTheDocument();
            yield userEvent.click(confirmButton);
            expect(screen.queryByRole('cell', { name: /some label$/i })).not.toBeInTheDocument();
            expect(mocks.reportInteraction).toHaveBeenLastCalledWith('grafana_correlations_deleted');
        }));
        it('correctly edits correlations', () => __awaiter(void 0, void 0, void 0, function* () {
            // wait for table to appear
            yield screen.findByRole('table');
            const tableRows = queryRowsByCellValue('Source', 'loki');
            const rowExpanderButton = within(tableRows[0]).getByRole('button', { name: /toggle row expanded/i });
            yield userEvent.click(rowExpanderButton);
            expect(mocks.reportInteraction).toHaveBeenLastCalledWith('grafana_correlations_details_expanded');
            yield userEvent.clear(screen.getByRole('textbox', { name: /label/i }));
            yield userEvent.type(screen.getByRole('textbox', { name: /label/i }), 'edited label');
            yield userEvent.clear(screen.getByRole('textbox', { name: /description/i }));
            yield userEvent.type(screen.getByRole('textbox', { name: /description/i }), 'edited description');
            expect(screen.queryByRole('cell', { name: /edited label$/i })).not.toBeInTheDocument();
            yield userEvent.click(screen.getByRole('button', { name: /next$/i }));
            yield userEvent.click(screen.getByRole('button', { name: /next$/i }));
            yield userEvent.click(screen.getByRole('button', { name: /save$/i }));
            expect(yield screen.findByRole('cell', { name: /edited label$/i })).toBeInTheDocument();
            expect(mocks.reportInteraction).toHaveBeenLastCalledWith('grafana_correlations_edited');
        }));
        it('correctly edits transformations', () => __awaiter(void 0, void 0, void 0, function* () {
            // wait for table to appear
            yield screen.findByRole('table');
            const tableRows = queryRowsByCellValue('Source', 'loki');
            const rowExpanderButton = within(tableRows[0]).getByRole('button', { name: /toggle row expanded/i });
            yield userEvent.click(rowExpanderButton);
            yield userEvent.click(screen.getByRole('button', { name: /next$/i }));
            yield userEvent.click(screen.getByRole('button', { name: /next$/i }));
            // select Logfmt, be sure expression field is disabled
            let typeFilterSelect = screen.getAllByLabelText('Type');
            openMenu(typeFilterSelect[0]);
            yield userEvent.click(screen.getByText('Logfmt'));
            let expressionInput = screen.queryByLabelText(/expression/i);
            expect(expressionInput).toBeInTheDocument();
            expect(expressionInput).toBeDisabled();
            // select Regex, be sure expression field is not disabled and contains the former expression
            openMenu(typeFilterSelect[0]);
            yield userEvent.click(screen.getByText('Regular expression', { selector: 'span' }));
            expressionInput = screen.queryByLabelText(/expression/i);
            expect(expressionInput).toBeInTheDocument();
            expect(expressionInput).toBeEnabled();
            expect(expressionInput).toHaveAttribute('value', 'url=http[s]?://(S*)');
            // select Logfmt, delete, then add a new one to be sure the value is blank
            openMenu(typeFilterSelect[0]);
            yield userEvent.click(screen.getByText('Logfmt'));
            yield userEvent.click(screen.getByRole('button', { name: /remove transformation/i }));
            expressionInput = screen.queryByLabelText(/expression/i);
            expect(expressionInput).not.toBeInTheDocument();
            yield userEvent.click(screen.getByRole('button', { name: /add transformation/i }));
            typeFilterSelect = screen.getAllByLabelText('Type');
            openMenu(typeFilterSelect[0]);
            yield userEvent.click(screen.getByText('Regular expression'));
            expressionInput = screen.queryByLabelText(/expression/i);
            expect(expressionInput).toBeInTheDocument();
            expect(expressionInput).toBeEnabled();
            expect(expressionInput).not.toHaveValue('url=http[s]?://(S*)');
            yield userEvent.click(screen.getByRole('button', { name: /save$/i }));
            expect(screen.getByText('Please define an expression')).toBeInTheDocument();
            yield userEvent.type(screen.getByLabelText(/expression/i), 'test expression');
            yield userEvent.click(screen.getByRole('button', { name: /save$/i }));
            expect(mocks.reportInteraction).toHaveBeenLastCalledWith('grafana_correlations_edited');
        }));
    });
    describe('With correlations with datasources the user cannot access', () => {
        let queryCellsByColumnName;
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            const renderResult = yield renderWithContext({
                loki: mockDataSource({
                    uid: 'loki',
                    name: 'loki',
                    readOnly: false,
                    jsonData: {},
                    access: 'direct',
                    type: 'datasource',
                }, {
                    logs: true,
                }),
            }, [
                {
                    sourceUID: 'loki',
                    targetUID: 'loki',
                    uid: '1',
                    label: 'Loki to Loki',
                    provisioned: false,
                    config: {
                        field: 'line',
                        target: {},
                        type: 'query',
                        transformations: [
                            { type: SupportedTransformationType.Regex, expression: 'url=http[s]?://(S*)', mapValue: 'path' },
                        ],
                    },
                },
                {
                    sourceUID: 'loki',
                    targetUID: 'prometheus',
                    uid: '2',
                    label: 'Loki to Prometheus',
                    provisioned: false,
                    config: {
                        field: 'line',
                        target: {},
                        type: 'query',
                        transformations: [
                            { type: SupportedTransformationType.Regex, expression: 'url=http[s]?://(S*)', mapValue: 'path' },
                        ],
                    },
                },
                {
                    sourceUID: 'prometheus',
                    targetUID: 'loki',
                    uid: '3',
                    label: 'Prometheus to Loki',
                    config: { field: 'label', target: {}, type: 'query' },
                    provisioned: false,
                },
                {
                    sourceUID: 'prometheus',
                    targetUID: 'prometheus',
                    uid: '4',
                    label: 'Prometheus to Prometheus',
                    config: { field: 'label', target: {}, type: 'query' },
                    provisioned: false,
                },
            ]);
            queryCellsByColumnName = renderResult.queryCellsByColumnName;
        }));
        it("doesn't show correlations from source or target datasources the user doesn't have access to", () => __awaiter(void 0, void 0, void 0, function* () {
            yield screen.findByRole('table');
            const labels = queryCellsByColumnName('Label');
            expect(labels.length).toBe(1);
            expect(labels[0].textContent).toBe('Loki to Loki');
        }));
    });
    describe('Read only correlations', () => {
        const correlations = [
            {
                sourceUID: 'loki',
                targetUID: 'loki',
                uid: '1',
                label: 'Some label',
                provisioned: true,
                config: {
                    field: 'line',
                    target: {},
                    type: 'query',
                    transformations: [{ type: SupportedTransformationType.Regex, expression: '(?:msg)=' }],
                },
            },
        ];
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            yield renderWithContext({
                loki: mockDataSource({
                    uid: 'loki',
                    name: 'loki',
                    readOnly: true,
                    jsonData: {},
                    access: 'direct',
                    meta: { info: { logos: {} } },
                    type: 'datasource',
                }),
            }, correlations);
        }));
        it("doesn't render delete button", () => __awaiter(void 0, void 0, void 0, function* () {
            // A row with the correlation should exist
            expect(yield screen.findByRole('cell', { name: /some label/i })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /delete correlation/i })).not.toBeInTheDocument();
        }));
        it('edit form is read only', () => __awaiter(void 0, void 0, void 0, function* () {
            // A row with the correlation should exist
            const rowExpanderButton = yield screen.findByRole('button', { name: /toggle row expanded/i });
            yield userEvent.click(rowExpanderButton);
            expect(mocks.reportInteraction).toHaveBeenLastCalledWith('grafana_correlations_details_expanded');
            // form elements should be readonly
            const labelInput = yield screen.findByRole('textbox', { name: /label/i });
            expect(labelInput).toBeInTheDocument();
            expect(labelInput).toHaveAttribute('readonly');
            const descriptionInput = screen.getByRole('textbox', { name: /description/i });
            expect(descriptionInput).toBeInTheDocument();
            expect(descriptionInput).toHaveAttribute('readonly');
            yield userEvent.click(screen.getByRole('button', { name: /next$/i }));
            yield userEvent.click(screen.getByRole('button', { name: /next$/i }));
            // expect the transformation to exist but be read only
            const expressionInput = screen.queryByLabelText(/expression/i);
            expect(expressionInput).toBeInTheDocument();
            expect(expressionInput).toHaveAttribute('readonly');
            expect(screen.queryByRole('button', { name: 'add transformation' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'remove transformation' })).not.toBeInTheDocument();
            // we don't expect the save button to be rendered
            expect(screen.queryByRole('button', { name: 'save' })).not.toBeInTheDocument();
        }));
    });
});
//# sourceMappingURL=CorrelationsPage.test.js.map