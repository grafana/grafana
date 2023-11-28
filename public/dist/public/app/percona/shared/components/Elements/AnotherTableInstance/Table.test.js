import { render, screen } from '@testing-library/react';
import React from 'react';
import { Table } from './Table';
const columns = [
    {
        Header: 'ID',
        accessor: 'id',
    },
    {
        Header: 'Test column',
        accessor: 'test',
    },
    {
        Header: 'Another test column',
        accessor: 'test2',
    },
];
const rows = [
    { id: 1, test: 1, test2: 1 },
    { id: 2, test: 1, test2: 1 },
    { id: 3, test: 1, test2: 1 },
    { id: 4, test: 1, test2: 1 },
];
describe('Table', () => {
    it('Render correct amount of rows', () => {
        render(React.createElement(Table, { columns: columns, data: rows }));
        expect(screen.getAllByTestId('table-row')).toHaveLength(rows.length);
        expect(screen.getAllByTestId('table-header')).toHaveLength(1);
    });
    it('Render no data section if empty rows passed', () => {
        render(React.createElement(Table, { columns: columns, data: [] }));
        expect(screen.queryByTestId('table-row')).not.toBeInTheDocument();
        expect(screen.getAllByTestId('table-no-data')).toHaveLength(1);
    });
    it('Render checkboxes if rowSelection is passed', () => {
        render(React.createElement(Table, { columns: columns, data: rows, rowSelection: true }));
        expect(screen.getAllByTestId('select-all')).toHaveLength(1);
        expect(screen.getAllByTestId('select-row')).toHaveLength(rows.length);
    });
    it('Render custom no data section if its passed', () => {
        const noData = React.createElement("div", { "data-testid": "custom-no-data" }, "123");
        render(React.createElement(Table, { columns: columns, data: [], noData: noData }));
        expect(screen.getAllByTestId('table-no-data')).toHaveLength(1);
        expect(screen.getAllByTestId('custom-no-data')).toHaveLength(1);
    });
    it('Render default no data section if no noData passed', () => {
        render(React.createElement(Table, { columns: columns, data: [] }));
        expect(screen.getAllByTestId('table-no-data')).toHaveLength(1);
    });
    it('Render spinner if table is loading', () => {
        const noData = React.createElement("div", { "data-testid": "custom-no-data" }, "123");
        render(React.createElement(Table, { columns: columns, data: [], noData: noData, loading: true }));
        expect(screen.getAllByTestId('table-loading')).toHaveLength(1);
        expect(screen.queryByTestId('table-no-data')).not.toBeInTheDocument();
        expect(screen.queryByTestId('custom-no-data')).not.toBeInTheDocument();
    });
});
//# sourceMappingURL=Table.test.js.map