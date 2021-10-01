import { mount } from 'enzyme';
import { dataTestId } from '@percona/platform-core';
import { TableContent } from './TableContent';
import React from 'react';

describe('TableContent', () => {
  it('should display the noData section when no data is passed', async () => {
    const wrapper = mount(<TableContent hasData={false} emptyMessage="empty" />);
    const noData = wrapper.find(dataTestId('table-no-data'));

    expect(noData).toHaveLength(1);
    expect(noData.text()).toEqual('empty');
  });

  it('should not display the noData section when no data is passed and it is still loading', async () => {
    const wrapper = mount(<TableContent loading={true} hasData={false} emptyMessage="empty" />);
    const noData = wrapper.find(dataTestId('table-no-data'));

    expect(noData).toHaveLength(1);
    expect(noData.text()).toHaveLength(0);
  });

  it('should display the table when there is data', async () => {
    const Dummy = () => <span></span>;
    const wrapper = mount(
      <TableContent hasData={true} emptyMessage="no data">
        <Dummy />
      </TableContent>
    );

    expect(wrapper.find(dataTestId('table-no-data'))).toHaveLength(0);
    expect(wrapper.find(Dummy).exists()).toBeTruthy();
  });
});
