import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { AlertRulesTable } from './AlertRulesTable';
import { act } from 'react-dom/test-utils';

const columns = [
  {
    Header: 'test col 1',
    accessor: 'value',
  },
];

const data = [
  {
    value: 'test value 1',
  },
  {
    value: 'test value 2',
  },
];

describe('AlertRulesTable', () => {
  it('should render the table correctly', async () => {
    let wrapper: ReactWrapper<any, Readonly<{}>, React.Component<{}, {}, any>>;

    await act(async () => {
      wrapper = mount(<AlertRulesTable data={data} columns={columns} />);
    });

    wrapper.update();

    expect(wrapper.find(dataQa('alert-rules-table-thead')).find('tr')).toHaveLength(1);
    expect(wrapper.find(dataQa('alert-rules-table-tbody')).find('tr')).toHaveLength(2);
    expect(wrapper.find(dataQa('alert-rules-table-no-data'))).toHaveLength(0);
  });

  it('should render the loader when data fetch is pending', async () => {
    const wrapper = mount(<AlertRulesTable data={data} columns={columns} pendingRequest />);

    expect(wrapper.find(dataQa('alert-rules-table-loading'))).toHaveLength(1);
    expect(wrapper.find(dataQa('alert-rules-table'))).toHaveLength(0);
    expect(wrapper.find(dataQa('alert-rules-table-no-data'))).toHaveLength(0);
  });

  it('should display the noData section when no data is passed', async () => {
    const wrapper = mount(<AlertRulesTable data={[]} columns={columns} emptyMessage="empty" />);
    const noData = wrapper.find(dataQa('alert-rules-table-no-data'));

    expect(wrapper.find(dataQa('alert-rules-table-loading'))).toHaveLength(0);
    expect(wrapper.find(dataQa('alert-rules-table'))).toHaveLength(0);
    expect(noData).toHaveLength(1);
    expect(noData.text()).toEqual('empty');
  });
});
