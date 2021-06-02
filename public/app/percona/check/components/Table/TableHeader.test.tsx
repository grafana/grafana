import React from 'react';
import { shallow } from 'enzyme';
import { COLUMNS } from 'app/percona/check/CheckPanel.constants';
import { TableHeader } from './TableHeader';



describe('TableHeader::', () => {
  it('should render a colgroup with 3 columns', () => {
    const root = shallow(<TableHeader columns={COLUMNS} />);

    expect(root.find('colgroup > col').length).toEqual(5);
    // Check if there widths in styles
    expect(
      root
        .find('colgroup > col')
        .at(1)
        .prop('style')
    ).toEqual({ minWidth: '200px', width: '200px' });

    root.unmount();
  });

  it('should render 3 column headers', () => {
    const root = shallow(<TableHeader columns={COLUMNS} />);

    expect(root.find('thead > tr > th').length).toEqual(5);

    // Check the header of the first column
    expect(
      root
        .find('th')
        .at(0)
        .text()
    ).toEqual('Service name');

    root.unmount();
  });
});
