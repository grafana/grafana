import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import createMockDatasource from '../../__mocks__/datasource';
import createMockQuery from '../../__mocks__/query';
import { selectors } from '../../e2e/selectors';
import ArgQueryEditor from './ArgQueryEditor';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getTemplateSrv: () => ({
        replace: (val) => {
            return val;
        },
    }) })));
const variableOptionGroup = {
    label: 'Template variables',
    options: [],
};
const defaultProps = {
    query: createMockQuery(),
    datasource: createMockDatasource(),
    variableOptionGroup: variableOptionGroup,
    onChange: jest.fn(),
    setError: jest.fn(),
};
describe('ArgQueryEditor', () => {
    it('should render', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(ArgQueryEditor, Object.assign({}, defaultProps)));
        expect(yield screen.findByTestId(selectors.components.queryEditor.argsQueryEditor.container.input)).toBeInTheDocument();
    }));
    it('should select a subscription from the fetched array', () => __awaiter(void 0, void 0, void 0, function* () {
        const datasource = createMockDatasource({
            getSubscriptions: jest.fn().mockResolvedValue([{ value: 'foo' }]),
        });
        const onChange = jest.fn();
        render(React.createElement(ArgQueryEditor, Object.assign({}, defaultProps, { datasource: datasource, onChange: onChange })));
        expect(yield screen.findByTestId(selectors.components.queryEditor.argsQueryEditor.container.input)).toBeInTheDocument();
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ subscriptions: ['foo'] }));
    }));
    it('should select a subscription from existing query', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const query = createMockQuery({
            subscriptions: ['bar'],
        });
        render(React.createElement(ArgQueryEditor, Object.assign({}, defaultProps, { onChange: onChange, query: query })));
        expect(yield screen.findByTestId(selectors.components.queryEditor.argsQueryEditor.container.input)).toBeInTheDocument();
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ subscriptions: ['bar'] }));
    }));
    it('should change the subscription if the selected one is not part of the fetched array', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const datasource = createMockDatasource({
            getSubscriptions: jest.fn().mockResolvedValue([{ value: 'foo' }]),
        });
        const query = createMockQuery({
            subscriptions: ['bar'],
        });
        render(React.createElement(ArgQueryEditor, Object.assign({}, defaultProps, { datasource: datasource, onChange: onChange, query: query })));
        expect(yield screen.findByTestId(selectors.components.queryEditor.argsQueryEditor.container.input)).toBeInTheDocument();
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ subscriptions: ['foo'] }));
        expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ subscriptions: ['bar'] }));
    }));
    it('should keep a subset of subscriptions if the new list does not contain all the query subscriptions', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const datasource = createMockDatasource({
            getSubscriptions: jest.fn().mockResolvedValue([{ value: 'foo' }, { value: 'bar' }]),
        });
        const query = createMockQuery({
            subscriptions: ['foo', 'bar', 'foobar'],
        });
        render(React.createElement(ArgQueryEditor, Object.assign({}, defaultProps, { datasource: datasource, onChange: onChange, query: query })));
        expect(yield screen.findByTestId(selectors.components.queryEditor.argsQueryEditor.container.input)).toBeInTheDocument();
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ subscriptions: ['foo', 'bar'] }));
        expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ subscriptions: ['foo', 'bar', 'foobar'] }));
    }));
    it('should keep a template variable if used in the subscription field', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const datasource = createMockDatasource({
            getSubscriptions: jest.fn().mockResolvedValue([{ value: 'foo' }]),
        });
        const query = createMockQuery({
            subscriptions: ['$test'],
        });
        render(React.createElement(ArgQueryEditor, Object.assign({}, defaultProps, { datasource: datasource, onChange: onChange, query: query, variableOptionGroup: { label: 'Template Variables', options: [{ label: '$test', value: '$test' }] } })));
        expect(yield screen.findByTestId(selectors.components.queryEditor.argsQueryEditor.container.input)).toBeInTheDocument();
        expect(yield screen.findByTestId(selectors.components.queryEditor.argsQueryEditor.subscriptions.input)).toHaveTextContent('$test');
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ subscriptions: ['$test'] }));
    }));
    it('should display an error if no subscription is selected', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const datasource = createMockDatasource({
            getSubscriptions: jest.fn().mockResolvedValue([]),
        });
        const query = createMockQuery({
            subscriptions: [],
        });
        render(React.createElement(ArgQueryEditor, Object.assign({}, defaultProps, { datasource: datasource, onChange: onChange, query: query, variableOptionGroup: { label: 'Template Variables', options: [] } })));
        expect(yield waitFor(() => screen.getByText('At least one subscription must be chosen.'))).toBeInTheDocument();
    }));
    it('should display an error if subscriptions are cleared', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const datasource = createMockDatasource({
            getSubscriptions: jest.fn().mockResolvedValue([{ text: 'foo', value: 'test-subscription-value' }]),
        });
        const query = createMockQuery({
            subscription: undefined,
            subscriptions: ['test-subscription-value'],
        });
        const { rerender } = render(React.createElement(ArgQueryEditor, Object.assign({}, defaultProps, { query: query, datasource: datasource, onChange: onChange, variableOptionGroup: { label: 'Template Variables', options: [] } })));
        expect(datasource.getSubscriptions).toHaveBeenCalled();
        expect(yield waitFor(() => onChange)).toHaveBeenCalledWith(expect.objectContaining({ subscriptions: ['test-subscription-value'] }));
        expect(yield waitFor(() => screen.findByText('foo'))).toBeInTheDocument();
        const clear = screen.getByLabelText('select-clear-value');
        yield userEvent.click(clear);
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ subscriptions: [] }));
        rerender(React.createElement(ArgQueryEditor, Object.assign({}, defaultProps, { datasource: datasource, onChange: onChange, query: Object.assign(Object.assign({}, query), { subscriptions: [] }), variableOptionGroup: { label: 'Template Variables', options: [] } })));
        expect(yield waitFor(() => screen.getByText('At least one subscription must be chosen.'))).toBeInTheDocument();
    }));
});
//# sourceMappingURL=ArgQueryEditor.test.js.map