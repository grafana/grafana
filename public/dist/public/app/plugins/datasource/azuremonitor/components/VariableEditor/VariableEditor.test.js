import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { select, openMenu } from 'react-select-event';
import createMockDatasource from '../../__mocks__/datasource';
import { AzureQueryType } from '../../types';
import VariableEditor from './VariableEditor';
// Have to mock CodeEditor because it doesnt seem to work in tests???
jest.mock('@grafana/ui', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/ui')), { CodeEditor: function CodeEditor({ value, onSave }) {
        return React.createElement("input", { "data-testid": "mockeditor", value: value, onChange: (event) => onSave(event.target.value) });
    } })));
const defaultProps = {
    query: {
        refId: 'A',
        queryType: AzureQueryType.LogAnalytics,
        azureLogAnalytics: {
            query: 'test query',
        },
        subscription: 'id',
    },
    onChange: jest.fn(),
    datasource: createMockDatasource({
        getSubscriptions: jest.fn().mockResolvedValue([{ text: 'Primary Subscription', value: 'sub' }]),
        getResourceGroups: jest.fn().mockResolvedValue([{ text: 'rg', value: 'rg' }]),
        getMetricNamespaces: jest.fn().mockResolvedValue([{ text: 'foo/bar', value: 'foo/bar' }]),
        getResourceNames: jest.fn().mockResolvedValue([{ text: 'foobar', value: 'foobar' }]),
        getVariablesRaw: jest.fn().mockReturnValue([
            { label: 'query0', name: 'sub0' },
            { label: 'query1', name: 'rg', query: { queryType: AzureQueryType.ResourceGroupsQuery } },
        ]),
    }),
};
describe('VariableEditor:', () => {
    it('can view a legacy Grafana query function', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const legacyQuery = Object.assign(Object.assign({}, defaultProps.query), { queryType: AzureQueryType.GrafanaTemplateVariableFn });
        render(React.createElement(VariableEditor, Object.assign({}, defaultProps, { onChange: onChange, query: legacyQuery })));
        yield waitFor(() => screen.getByLabelText('select query type'));
        expect(screen.getByLabelText('select query type')).toBeInTheDocument();
        yield userEvent.click(screen.getByLabelText('select query type'));
        yield select(screen.getByLabelText('select query type'), 'Grafana Query Function', {
            container: document.body,
        });
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            queryType: AzureQueryType.GrafanaTemplateVariableFn,
        }));
    }));
    describe('log queries:', () => {
        it('should render', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(VariableEditor, Object.assign({}, defaultProps)));
            yield waitFor(() => screen.queryByTestId('mockeditor'));
            expect(screen.queryByText('Resource')).toBeInTheDocument();
            expect(screen.queryByTestId('mockeditor')).toBeInTheDocument();
        }));
        it('should call on change if the query changes', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            render(React.createElement(VariableEditor, Object.assign({}, defaultProps, { onChange: onChange })));
            yield waitFor(() => screen.queryByTestId('mockeditor'));
            expect(screen.queryByTestId('mockeditor')).toBeInTheDocument();
            yield userEvent.type(screen.getByTestId('mockeditor'), '{backspace}');
            expect(onChange).toHaveBeenCalledWith({
                azureLogAnalytics: {
                    query: 'test quer',
                },
                queryType: 'Azure Log Analytics',
                refId: 'A',
                subscription: 'id',
            });
        }));
    });
    describe('Azure Resource Graph queries:', () => {
        const ARGqueryProps = Object.assign(Object.assign({}, defaultProps), { query: {
                refId: 'A',
                queryType: AzureQueryType.AzureResourceGraph,
                azureResourceGraph: {
                    query: 'Resources | distinct type',
                    resultFormat: 'table',
                },
                subscriptions: ['sub'],
            } });
        it('should render', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(VariableEditor, Object.assign({}, ARGqueryProps)));
            yield waitFor(() => screen.queryByTestId('mockeditor'));
            yield waitFor(() => screen.queryByLabelText('Subscriptions'));
            expect(screen.queryByText('Resource Graph')).toBeInTheDocument();
            expect(screen.queryByLabelText('Select subscription')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Select query type')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Select resource group')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Select namespace')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Select resource')).not.toBeInTheDocument();
            expect(screen.queryByTestId('mockeditor')).toBeInTheDocument();
        }));
        it('should call on change if the query changes', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            render(React.createElement(VariableEditor, Object.assign({}, ARGqueryProps, { onChange: onChange })));
            yield waitFor(() => screen.queryByTestId('mockeditor'));
            expect(screen.queryByTestId('mockeditor')).toBeInTheDocument();
            yield userEvent.type(screen.getByTestId('mockeditor'), '{backspace}');
            expect(onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, ARGqueryProps.query), { azureResourceGraph: {
                    query: 'Resources | distinct typ',
                    resultFormat: 'table',
                } }));
        }));
    });
    describe('grafana template variable fn queries:', () => {
        it('should render', () => __awaiter(void 0, void 0, void 0, function* () {
            const props = Object.assign(Object.assign({}, defaultProps), { query: {
                    refId: 'A',
                    queryType: AzureQueryType.GrafanaTemplateVariableFn,
                    grafanaTemplateVariableFn: {
                        rawQuery: 'test query',
                        kind: 'SubscriptionsQuery',
                    },
                    subscription: 'id',
                } });
            render(React.createElement(VariableEditor, Object.assign({}, props)));
            yield waitFor(() => screen.queryByText('Grafana template variable function'));
            expect(screen.queryByText('Grafana template variable function')).toBeInTheDocument();
            expect(screen.queryByDisplayValue('test query')).toBeInTheDocument();
        }));
        it('should call on change if the query changes', () => __awaiter(void 0, void 0, void 0, function* () {
            const props = Object.assign(Object.assign({}, defaultProps), { query: {
                    refId: 'A',
                    queryType: AzureQueryType.GrafanaTemplateVariableFn,
                    grafanaTemplateVariableFn: {
                        rawQuery: 'Su',
                        kind: 'UnknownQuery',
                    },
                    subscription: 'subscriptionId',
                } });
            render(React.createElement(VariableEditor, Object.assign({}, props)));
            yield waitFor(() => screen.queryByText('Grafana template variable function'));
            yield userEvent.type(screen.getByDisplayValue('Su'), 'bscriptions()');
            expect(screen.getByDisplayValue('Subscriptions()')).toBeInTheDocument();
            screen.getByDisplayValue('Subscriptions()').blur();
            yield waitFor(() => screen.queryByText('None'));
            expect(props.onChange).toHaveBeenCalledWith({
                refId: 'A',
                queryType: AzureQueryType.GrafanaTemplateVariableFn,
                grafanaTemplateVariableFn: {
                    rawQuery: 'Subscriptions()',
                    kind: 'SubscriptionsQuery',
                },
                subscription: 'subscriptionId',
            });
        }));
    });
    describe('predefined queries:', () => {
        const selectAndRerender = (label, text, onChange, rerender) => __awaiter(void 0, void 0, void 0, function* () {
            openMenu(screen.getByLabelText(label));
            yield userEvent.click(screen.getByText(text));
            // Simulate onChange behavior
            const newQuery = onChange.mock.calls.at(-1)[0];
            rerender(React.createElement(VariableEditor, Object.assign({}, defaultProps, { query: newQuery, onChange: onChange })));
            yield waitFor(() => expect(screen.getByText(text)).toBeInTheDocument());
        });
        it('should run the query if requesting subscriptions', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            const { rerender } = render(React.createElement(VariableEditor, Object.assign({}, defaultProps, { onChange: onChange })));
            yield selectAndRerender('select query type', 'Subscriptions', onChange, rerender);
            expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ queryType: AzureQueryType.SubscriptionsQuery, refId: 'A' }));
        }));
        it('should run the query if requesting resource groups', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            const { rerender } = render(React.createElement(VariableEditor, Object.assign({}, defaultProps, { onChange: onChange })));
            // wait for initial load
            yield waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
            yield selectAndRerender('select query type', 'Resource Groups', onChange, rerender);
            yield selectAndRerender('select subscription', 'Primary Subscription', onChange, rerender);
            expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
                queryType: AzureQueryType.ResourceGroupsQuery,
                subscription: 'sub',
                refId: 'A',
            }));
        }));
        it('should show template variables as options ', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            const { rerender } = render(React.createElement(VariableEditor, Object.assign({}, defaultProps, { onChange: onChange })));
            // wait for initial load
            yield waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
            yield selectAndRerender('select query type', 'Resource Groups', onChange, rerender);
            // Select a subscription
            openMenu(screen.getByLabelText('select subscription'));
            yield waitFor(() => expect(screen.getByText('Primary Subscription')).toBeInTheDocument());
            yield userEvent.click(screen.getByText('Template Variables'));
            // Simulate onChange behavior
            const lastQuery = onChange.mock.calls.at(-1)[0];
            rerender(React.createElement(VariableEditor, Object.assign({}, defaultProps, { query: lastQuery, onChange: onChange })));
            yield waitFor(() => expect(screen.getByText('query0')).toBeInTheDocument());
            // Template variables of the same type than the current one should not appear
            expect(screen.queryByText('query1')).not.toBeInTheDocument();
        }));
        it('should run the query if requesting namespaces', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            const { rerender } = render(React.createElement(VariableEditor, Object.assign({}, defaultProps, { onChange: onChange })));
            // wait for initial load
            yield waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
            yield selectAndRerender('select query type', 'Namespaces', onChange, rerender);
            yield selectAndRerender('select subscription', 'Primary Subscription', onChange, rerender);
            expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
                queryType: AzureQueryType.NamespacesQuery,
                subscription: 'sub',
                refId: 'A',
            }));
        }));
        it('should run the query if requesting resource names', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            const { rerender } = render(React.createElement(VariableEditor, Object.assign({}, defaultProps, { onChange: onChange })));
            // wait for initial load
            yield waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
            yield selectAndRerender('select query type', 'Resource Names', onChange, rerender);
            yield selectAndRerender('select subscription', 'Primary Subscription', onChange, rerender);
            yield selectAndRerender('select region', 'North Europe', onChange, rerender);
            expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
                queryType: AzureQueryType.ResourceNamesQuery,
                subscription: 'sub',
                region: 'northeurope',
                refId: 'A',
            }));
        }));
        it('should run the query if requesting metric names', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            const { rerender } = render(React.createElement(VariableEditor, Object.assign({}, defaultProps, { onChange: onChange })));
            // wait for initial load
            yield waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
            yield selectAndRerender('select query type', 'Metric Names', onChange, rerender);
            yield selectAndRerender('select subscription', 'Primary Subscription', onChange, rerender);
            yield selectAndRerender('select resource group', 'rg', onChange, rerender);
            yield selectAndRerender('select namespace', 'foo/bar', onChange, rerender);
            yield selectAndRerender('select resource', 'foobar', onChange, rerender);
            expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
                queryType: AzureQueryType.MetricNamesQuery,
                subscription: 'sub',
                resourceGroup: 'rg',
                namespace: 'foo/bar',
                resource: 'foobar',
                refId: 'A',
            }));
        }));
        it('should clean up related fields', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            const { rerender } = render(React.createElement(VariableEditor, Object.assign({}, defaultProps, { onChange: onChange })));
            // wait for initial load
            yield waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
            // Select a new query type
            yield selectAndRerender('select query type', 'Subscriptions', onChange, rerender);
            expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
                queryType: AzureQueryType.SubscriptionsQuery,
                subscription: undefined,
                resourceGroup: undefined,
                namespace: undefined,
                resource: undefined,
                refId: 'A',
            }));
        }));
        it('should run the query if requesting workspaces', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            const { rerender } = render(React.createElement(VariableEditor, Object.assign({}, defaultProps, { onChange: onChange })));
            // wait for initial load
            yield waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
            yield selectAndRerender('select query type', 'Workspaces', onChange, rerender);
            yield selectAndRerender('select subscription', 'Primary Subscription', onChange, rerender);
            expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
                queryType: AzureQueryType.WorkspacesQuery,
                subscription: 'sub',
                refId: 'A',
            }));
        }));
        it('should run the query if requesting regions', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            const { rerender } = render(React.createElement(VariableEditor, Object.assign({}, defaultProps, { onChange: onChange })));
            // wait for initial load
            yield waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
            yield selectAndRerender('select query type', 'Regions', onChange, rerender);
            yield selectAndRerender('select subscription', 'Primary Subscription', onChange, rerender);
            expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
                queryType: AzureQueryType.LocationsQuery,
                subscription: 'sub',
                refId: 'A',
            }));
        }));
    });
});
//# sourceMappingURL=VariableEditor.test.js.map