import React from 'react';
import { dataQa } from '@percona/platform-core';
import { getMount } from 'app/percona/shared/helpers/testUtils';
import { AlertRules } from './AlertRules';
import { AlertRuleTemplateService } from '../AlertRuleTemplate/AlertRuleTemplate.service';
import { NotificationChannelService } from '../NotificationChannel/NotificationChannel.service';
import { NotificationChannelType } from '../NotificationChannel/NotificationChannel.types';
import { templateStubs } from '../AlertRuleTemplate/__mocks__/alertRuleTemplateStubs';
import { AlertRulesService } from './AlertRules.service';

const notificationChannelsServiceList = jest.spyOn(NotificationChannelService, 'list').mockImplementation(() =>
  Promise.resolve({
    totals: {
      total_items: 2,
      total_pages: 1,
    },
    channels: [
      {
        type: NotificationChannelType.email,
        channelId: 'testId',
        summary: 'test',
        disabled: false,
      },
      {
        type: NotificationChannelType.email,
        channelId: 'testId',
        summary: 'test',
        disabled: false,
      },
    ],
  })
);

const alertRuleTemplateServiceList = jest.spyOn(AlertRuleTemplateService, 'list').mockImplementation(() =>
  Promise.resolve({
    templates: templateStubs,
    totals: { total_items: 4, total_pages: 1 },
  })
);

jest.mock('./AlertRules.service');

describe('AlertRules', () => {
  it('gets the templates when mounted', async () => {
    expect(alertRuleTemplateServiceList).toBeCalledTimes(0);
    expect(notificationChannelsServiceList).toBeCalledTimes(0);

    const wrapper = await getMount(<AlertRules />);

    expect(alertRuleTemplateServiceList).toBeCalledTimes(1);
    expect(notificationChannelsServiceList).toBeCalledTimes(1);

    wrapper.unmount();
  });

  it('should toggle selected alert rule details', async () => {
    const wrapper = await getMount(<AlertRules />);

    wrapper.update();
    wrapper.find(dataQa('show-alert-rule-details')).at(0).find('button').simulate('click');

    expect(wrapper.find(dataQa('alert-rules-details'))).toHaveLength(1);

    wrapper.find(dataQa('hide-alert-rule-details')).at(0).find('button').simulate('click');

    expect(wrapper.find(dataQa('alert-rules-details'))).toHaveLength(0);
  });

  it('should have table initially loading', async () => {
    const wrapper = await getMount(<AlertRules />);

    expect(wrapper.find(dataQa('table-loading'))).toHaveLength(1);
    expect(wrapper.find(dataQa('table-no-data'))).toHaveLength(1);
  });

  it('should render table content', async () => {
    const wrapper = await getMount(<AlertRules />);

    wrapper.update();

    expect(wrapper.find(dataQa('table-thead')).find('tr')).toHaveLength(1);
    expect(wrapper.find(dataQa('table-tbody')).find('tr')).toHaveLength(6);
    expect(wrapper.find(dataQa('table-no-data'))).toHaveLength(0);
  });

  it('should render correctly without data', async () => {
    jest
      .spyOn(AlertRulesService, 'list')
      .mockReturnValueOnce(Promise.resolve({ rules: [], totals: { total_items: 0, total_pages: 0 } }));

    const wrapper = await getMount(<AlertRules />);

    wrapper.update();

    expect(wrapper.find(dataQa('table-thead')).find('tr')).toHaveLength(0);
    expect(wrapper.find(dataQa('table-tbody')).find('tr')).toHaveLength(0);
    expect(wrapper.find(dataQa('table-no-data'))).toHaveLength(1);
  });
});
