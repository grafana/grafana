import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { AlertRulesTable } from './AlertRulesTable';
import { act } from 'react-dom/test-utils';

// const consoleLog = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('AddAlertRuleTemplatesTable', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the table correctly', async () => {
    let wrapper: ReactWrapper<any, Readonly<{}>, React.Component<{}, {}, any>>;

    await act(async () => {
      wrapper = mount(<AlertRulesTable />);
    });

    wrapper.update();

    expect(wrapper.find(dataQa('alert-rules-table-thead')).find('tr')).toHaveLength(1);
    expect(wrapper.find(dataQa('alert-rules-table-tbody')).find('tr')).toHaveLength(6);
    expect(wrapper.find(dataQa('alert-rules-table-no-data'))).toHaveLength(0);
  });
});
