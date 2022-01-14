import { mount } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { TableContent } from './TableContent';
import React from 'react';

describe('TableContent', () => {
  it('should render the loader when data fetch is pending', async () => {
    const wrapper = mount(<TableContent pending hasData={false} emptyMessage="no data" />);

    expect(wrapper.find(dataQa('table-loading'))).toHaveLength(1);
    expect(wrapper.find(dataQa('table-no-data'))).toHaveLength(0);
  });

  it('should display the noData section when no data is passed', async () => {
    const wrapper = mount(<TableContent pending={false} hasData={false} emptyMessage="empty" />);
    const noData = wrapper.find(dataQa('table-no-data'));

    expect(wrapper.find(dataQa('table-loading'))).toHaveLength(0);
    expect(noData).toHaveLength(1);
    expect(noData.text()).toEqual('empty');
  });

  it('should display the table when done pending and there is data', async () => {
    const Dummy = () => <span></span>;
    const wrapper = mount(
      <TableContent pending={false} hasData={true} emptyMessage="no data">
        <Dummy />
      </TableContent>
    );

    expect(wrapper.find(dataQa('table-loading'))).toHaveLength(0);
    expect(wrapper.find(dataQa('table-no-data'))).toHaveLength(0);
    expect(wrapper.find(Dummy).exists()).toBeTruthy();
  });
});
