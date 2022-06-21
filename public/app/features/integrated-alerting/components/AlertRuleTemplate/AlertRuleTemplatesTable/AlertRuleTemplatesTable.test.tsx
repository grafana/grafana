import { dataQa } from '@percona/platform-core';
import { mount } from 'enzyme';
import React from 'react';

import { formattedTemplateStubs } from '../__mocks__/alertRuleTemplateStubs';

import { AlertRuleTemplatesTable } from './AlertRuleTemplatesTable';

describe('AlertRuleTemplatesTable', () => {
  it('should render the table correctly', async () => {
    const wrapper = mount(
      <AlertRuleTemplatesTable pendingRequest={false} data={formattedTemplateStubs} getAlertRuleTemplates={jest.fn()} />
    );

    expect(wrapper.find(dataQa('alert-rule-templates-table-thead')).find('tr')).toHaveLength(1);
    expect(wrapper.find(dataQa('alert-rule-templates-table-tbody')).find('tr')).toHaveLength(3);
    expect(wrapper.find(dataQa('alert-rule-templates-table-no-data'))).toHaveLength(0);
  });

  it('should render correctly when pending', async () => {
    const wrapper = mount(
      <AlertRuleTemplatesTable pendingRequest={true} data={[]} getAlertRuleTemplates={jest.fn()} />
    );

    expect(wrapper.find(dataQa('alert-rule-templates-table-loading'))).toHaveLength(1);
    expect(wrapper.find(dataQa('alert-rule-templates-table'))).toHaveLength(0);
    expect(wrapper.find(dataQa('alert-rule-templates-table-no-data'))).toHaveLength(0);
  });

  it('should render correctly without data', async () => {
    const wrapper = mount(
      <AlertRuleTemplatesTable pendingRequest={false} data={[]} getAlertRuleTemplates={jest.fn()} />
    );

    expect(wrapper.find(dataQa('alert-rule-templates-table-loading'))).toHaveLength(0);
    expect(wrapper.find(dataQa('alert-rule-templates-table'))).toHaveLength(0);
    expect(wrapper.find(dataQa('alert-rule-templates-table-no-data'))).toHaveLength(1);
  });
});
