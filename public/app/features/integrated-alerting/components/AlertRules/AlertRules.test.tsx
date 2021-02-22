import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { AlertRules } from './AlertRules';
import { act } from 'react-dom/test-utils';
import { AlertRuleTemplateService } from '../AlertRuleTemplate/AlertRuleTemplate.service';
import { NotificationChannelService } from '../NotificationChannel/NotificationChannel.service';
import { NotificationChannelType } from '../NotificationChannel/NotificationChannel.types';
import { templateStubs } from '../AlertRuleTemplate/__mocks__/alertRuleTemplateStubs';
import { AlertRulesService } from './AlertRules.service';

const notificationChannelsServiceList = jest.spyOn(NotificationChannelService, 'list').mockImplementation(() =>
  Promise.resolve([
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
  ])
);

const alertRuleTemplateServiceList = jest.spyOn(AlertRuleTemplateService, 'list').mockImplementation(() =>
  Promise.resolve({
    templates: templateStubs,
  })
);

jest.mock('./AlertRules.service');

describe('AlertRules', () => {
  it('gets the templates when mounted', async () => {
    let wrapper: ReactWrapper<{}, {}, any>;

    expect(alertRuleTemplateServiceList).toBeCalledTimes(0);
    expect(notificationChannelsServiceList).toBeCalledTimes(0);

    await act(async () => {
      wrapper = await mount(<AlertRules />);
    });

    expect(alertRuleTemplateServiceList).toBeCalledTimes(1);
    expect(notificationChannelsServiceList).toBeCalledTimes(1);

    wrapper.unmount();
  });

  it('should toggle selected alert rule details', async () => {
    let wrapper: ReactWrapper<{}, {}, any>;

    await act(async () => {
      wrapper = await mount(<AlertRules />);
    });

    wrapper.update();
    wrapper
      .find(dataQa('show-alert-rule-details'))
      .at(0)
      .find('button')
      .simulate('click');

    expect(wrapper.find(dataQa('alert-rules-details'))).toHaveLength(1);

    wrapper
      .find(dataQa('hide-alert-rule-details'))
      .at(0)
      .find('button')
      .simulate('click');

    expect(wrapper.find(dataQa('alert-rules-details'))).toHaveLength(0);
  });

  it('should have table initially loading', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = await mount(<AlertRules />);
    });

    expect(wrapper.find(dataQa('table-loading'))).toHaveLength(1);
    expect(wrapper.find(dataQa('table-thead')).find('tr')).toHaveLength(0);
    expect(wrapper.find(dataQa('table-no-data'))).toHaveLength(0);
  });

  it('should render table content', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = await mount(<AlertRules />);
    });

    wrapper.update();

    expect(wrapper.find(dataQa('table-thead')).find('tr')).toHaveLength(1);
    expect(wrapper.find(dataQa('table-tbody')).find('tr')).toHaveLength(6);
    expect(wrapper.find(dataQa('table-no-data'))).toHaveLength(0);
  });

  it('should render correctly without data', async () => {
    jest
      .spyOn(AlertRulesService, 'list')
      .mockReturnValueOnce(Promise.resolve({ rules: [], totals: { total_items: 0, total_pages: 0 } }));

    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = await mount(<AlertRules />);
    });

    wrapper.update();

    expect(wrapper.find(dataQa('table-thead')).find('tr')).toHaveLength(0);
    expect(wrapper.find(dataQa('table-tbody')).find('tr')).toHaveLength(0);
    expect(wrapper.find(dataQa('table-no-data'))).toHaveLength(1);
  });
});
