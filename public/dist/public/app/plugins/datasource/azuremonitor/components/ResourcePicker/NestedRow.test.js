import { render, screen } from '@testing-library/react';
import React from 'react';
import NestedRow from './NestedRow';
import { ResourceRowType } from './types';
const defaultProps = {
    row: {
        id: '1',
        uri: 'some-uri',
        name: '1',
        type: ResourceRowType.Resource,
        typeLabel: '1',
    },
    level: 0,
    selectedRows: [],
    requestNestedRows: jest.fn(),
    onRowSelectedChange: jest.fn(),
    selectableEntryTypes: [],
    scrollIntoView: false,
    disableRow: jest.fn().mockReturnValue(false),
};
describe('NestedRow', () => {
    it('should not display a checkbox when the type of row is empty', () => {
        render(React.createElement("table", null,
            React.createElement("tbody", null,
                React.createElement(NestedRow, Object.assign({}, defaultProps)))));
        const box = screen.queryByRole('checkbox');
        expect(box).not.toBeInTheDocument();
    });
    it('should display a checkbox when the type of row is in selectableEntryTypes', () => {
        render(React.createElement("table", null,
            React.createElement("tbody", null,
                React.createElement(NestedRow, Object.assign({}, defaultProps, { selectableEntryTypes: [ResourceRowType.Resource] })))));
        const box = screen.queryByRole('checkbox');
        expect(box).toBeInTheDocument();
    });
    it('should not display a checkbox when the type of row is not in selectableEntryTypes', () => {
        render(React.createElement("table", null,
            React.createElement("tbody", null,
                React.createElement(NestedRow, Object.assign({}, defaultProps, { selectableEntryTypes: [ResourceRowType.ResourceGroup] })))));
        const box = screen.queryByRole('checkbox');
        expect(box).not.toBeInTheDocument();
    });
    it('should disable a checkbox if specified', () => {
        render(React.createElement("table", null,
            React.createElement("tbody", null,
                React.createElement(NestedRow, Object.assign({}, defaultProps, { selectableEntryTypes: [ResourceRowType.Resource], disableRow: () => true })))));
        const box = screen.queryByRole('checkbox');
        expect(box).toBeDisabled();
    });
    it('should check a checkbox if the uri matches regardless of the case', () => {
        render(React.createElement("table", null,
            React.createElement("tbody", null,
                React.createElement(NestedRow, Object.assign({}, defaultProps, { selectableEntryTypes: [ResourceRowType.Resource], selectedRows: [Object.assign(Object.assign({}, defaultProps.row), { uri: defaultProps.row.uri.toUpperCase() })] })))));
        const box = screen.queryByRole('checkbox');
        expect(box).toBeChecked();
    });
});
//# sourceMappingURL=NestedRow.test.js.map