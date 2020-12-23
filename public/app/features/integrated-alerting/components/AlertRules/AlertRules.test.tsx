import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { AlertRules } from './AlertRules';
import { act } from 'react-dom/test-utils';
import { AlertRuleTemplateService } from '../AlertRuleTemplate/AlertRuleTemplate.service';
import { NotificationChannelService } from '../NotificationChannel/NotificationChannel.service';
import { NotificationChannelType } from '../NotificationChannel/NotificationChannel.types';
import { templateStubs } from '../AlertRuleTemplate/__mocks__/alertRuleTemplateStubs';

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
      wrapper = mount(<AlertRules />);
    });

    expect(alertRuleTemplateServiceList).toBeCalledTimes(1);
    expect(notificationChannelsServiceList).toBeCalledTimes(1);

    wrapper.unmount();
  });
});
