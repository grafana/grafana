import { __awaiter } from "tslib";
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { openMenu } from 'react-select-event';
import createMockDatasource from '../../__mocks__/datasource';
import createMockQuery from '../../__mocks__/query';
import { selectors } from '../../e2e/selectors';
import TraceTypeField from './TraceTypeField';
import { Tables } from './consts';
import { setTraceTypes } from './setQueryValue';
const props = {
    query: createMockQuery(),
    datasource: createMockDatasource(),
    variableOptionGroup: { label: 'Templates', options: [] },
    onQueryChange: jest.fn(),
    setError: jest.fn(),
};
describe('TraceTypeField', () => {
    it('should render with default types', () => __awaiter(void 0, void 0, void 0, function* () {
        const query = Object.assign(Object.assign({}, props.query), { azureTraces: Object.assign(Object.assign({}, props.query.azureTraces), { traceTypes: [] }) });
        render(React.createElement(TraceTypeField, Object.assign({}, props, { query: query })));
        expect(screen.getByText('Choose event types')).toBeInTheDocument();
        const menu = screen.getByLabelText(selectors.components.queryEditor.tracesQueryEditor.traceTypes.select);
        openMenu(menu);
        Object.values(Tables).forEach((table) => {
            expect(screen.getByText(table.label)).toBeInTheDocument();
        });
    }));
    it('should render the value defined in the query', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(TraceTypeField, Object.assign({}, props)));
        expect(screen.getByText('Traces')).toBeInTheDocument();
    }));
    it('should update the query', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const { rerender } = render(React.createElement(TraceTypeField, Object.assign({}, props)));
        expect(screen.getByText('Traces')).toBeInTheDocument();
        const menu = screen.getByLabelText(selectors.components.queryEditor.tracesQueryEditor.traceTypes.select);
        openMenu(menu);
        act(() => {
            screen.getByText('Dependencies').click();
        });
        const newQuery = setTraceTypes(props.query, [...(_a = props.query.azureTraces) === null || _a === void 0 ? void 0 : _a.traceTypes, 'dependencies']);
        expect(props.onQueryChange).toHaveBeenCalledWith(newQuery);
        rerender(React.createElement(TraceTypeField, Object.assign({}, props, { query: newQuery })));
        expect(screen.getByText('Dependencies')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=TraceTypeField.test.js.map