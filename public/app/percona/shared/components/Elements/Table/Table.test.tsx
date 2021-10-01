import React from 'react';
import { mount, shallow } from 'enzyme';
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
    const root = shallow(<Table columns={columns} data={rows} />);

    expect(root.find('[data-testid="table-row"]').length).toEqual(rows.length);
    expect(root.find('[data-testid="table-header"]').length).toEqual(1);
  });

  it('Render no data section if empty rows passed', () => {
    const root = shallow(<Table columns={columns} data={[]} />);

    expect(root.find('[data-testid="table-row"]').length).toEqual(0);
    expect(root.find('[data-testid="table-no-data"]').length).toEqual(1);
  });

  it('Render checkboxes if rowSelection is passed', () => {
    const root = mount(<Table columns={columns} data={rows} rowSelection />);

    expect(root.find('[data-testid="select-all"]').length).toEqual(1);
    expect(root.find('[data-testid="select-row"]').length).toEqual(rows.length);
  });

  it('Render custom no data section if its passed', () => {
    const noData = <div data-testid="custom-no-data">123</div>;
    const root = shallow(<Table columns={columns} data={[]} noData={noData} />);

    expect(root.find('[data-testid="table-no-data"]').length).toEqual(1);
    expect(root.find('[data-testid="custom-no-data"]').length).toEqual(1);
  });

  it('Render default no data section if no noData passed', () => {
    const root = shallow(<Table columns={columns} data={[]} />);

    expect(root.find('[data-testid="table-no-data"]').length).toEqual(1);
  });

  it('Render spinner if table is loading', () => {
    const noData = <div data-testid="custom-no-data">123</div>;
    const root = shallow(<Table columns={columns} data={[]} noData={noData} loading />);

    expect(root.find('[data-testid="table-loading"]').length).toEqual(1);
    expect(root.find('[data-testid="table-no-data"]').length).toEqual(0);
    expect(root.find('[data-testid="custom-no-data"]').length).toEqual(0);
  });
});
