import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { AlertRuleTemplatesTable } from './AlertRuleTemplatesTable';
import { AlertRuleTemplateService } from '../AlertRuleTemplate.service';
import { act } from 'react-dom/test-utils';

jest.spyOn(AlertRuleTemplateService, 'list').mockImplementation(() =>
  Promise.resolve({
    templates: [
      {
        created_at: '2020-11-25T16:53:39.366Z',
        source: 'BUILT_IN',
        summary: 'MySQL database down',
      },
      {
        created_at: '2020-11-25T16:53:39.366Z',
        source: 'SAAS',
        summary: 'MongoDB database down',
      },
      {
        created_at: '2020-11-25T16:53:39.366Z',
        source: 'USER_FILE',
        summary: 'High memory consumption',
      },
    ],
  })
);

describe('AddAlertRuleTemplatesTable', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the table correctly', async () => {
    let wrapper: ReactWrapper<any, Readonly<{}>, React.Component<{}, {}, any>>;

    await act(async () => {
      wrapper = mount(<AlertRuleTemplatesTable />);
    });

    wrapper.update();

    expect(wrapper.find(dataQa('alert-rule-templates-table-thead')).find('tr')).toHaveLength(1);
    expect(wrapper.find(dataQa('alert-rule-templates-table-tbody')).find('tr')).toHaveLength(3);
    expect(wrapper.find(dataQa('alert-rule-templates-table-no-data'))).toHaveLength(0);
  });

  it('should not render modal when visible is set to false', async () => {
    jest.spyOn(AlertRuleTemplateService, 'list').mockImplementation(() => {
      throw Error('test error');
    });

    let wrapper: ReactWrapper<any, Readonly<{}>, React.Component<{}, {}, any>>;

    await act(async () => {
      wrapper = mount(<AlertRuleTemplatesTable />);
    });

    wrapper.update();

    expect(wrapper.find(dataQa('alert-rule-templates-table-no-data'))).toHaveLength(1);
  });
});
