import React from 'react';
import { mount } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { AddAlertRuleModal } from './AddAlertRuleModal';
import { AlertRule } from '../AlertRules.types';

jest.mock('../AlertRules.service');
jest.mock('../../AlertRuleTemplate/AlertRuleTemplate.service');
jest.mock('../../NotificationChannel/NotificationChannel.service');

jest.mock('app/core/app_events', () => {
  return {
    appEvents: {
      emit: jest.fn(),
    },
  };
});

describe('AddAlertRuleModal', () => {
  const initialValues: AlertRule = {
    ruleId: '/rule_id/ded33d30-1b65-4b43-ba45-75ca52b48fa5',
    createdAt: '2021-01-19 12:53:16.082',
    duration: '3600s',
    filters: [],
    severity: 'Critical',
    summary: 'Just a summary',
    threshold: '1 %',
    lastNotified: '',
    disabled: false,
    rawValues: {
      channels: [],
      filters: [],
      disabled: false,
      template: {
        name: 'pmm_mongodb_connections_memory_usage',
        summary: 'Memory used by MongoDB connections',
        params: [],
      },
      rule_id: '/rule_id/ded33d30-1b65-4b43-ba45-75ca52b48fa5',
      summary: 'Just a summary',
      params: [],
      for: '3600s',
      severity: 'SEVERITY_CRITICAL',
      created_at: '2021-01-19T12:53:16.082610Z',
    },
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render modal', () => {
    const wrapper = mount(<AddAlertRuleModal setVisible={jest.fn()} isVisible />);

    expect(wrapper.find(dataQa('add-alert-rule-modal')).exists()).toBeTruthy();
    expect(wrapper.find(dataQa('add-alert-rule-modal-form')).exists()).toBeTruthy();
    expect(wrapper.find(dataQa('add-alert-rule-modal-add-button')).exists()).toBeTruthy();
  });

  it('does not render the modal when visible is set to false', async () => {
    const wrapper = mount(<AddAlertRuleModal setVisible={jest.fn()} isVisible={false} />);

    expect(wrapper.find(dataQa('add-alert-rule-modal-form')).length).toBe(0);
  });

  it('renders the modal when visible is set to true', async () => {
    const wrapper = mount(<AddAlertRuleModal setVisible={jest.fn()} isVisible />);

    expect(wrapper.find(dataQa('add-alert-rule-modal-form')).length).toBe(1);
  });

  it('should have the submit button disabled by default when adding a new rule', () => {
    const wrapper = mount(<AddAlertRuleModal setVisible={jest.fn()} isVisible />);
    const button = wrapper.find(dataQa('add-alert-rule-modal-add-button')).find('button');

    expect(button.props().disabled).toBe(true);
  });

  it('should enable the submit button if all fields are valid', () => {
    const wrapper = mount(<AddAlertRuleModal setVisible={jest.fn()} isVisible alertRule={initialValues} />);

    const thresholdInput = wrapper.find(dataQa('threshold-text-input'));
    thresholdInput.simulate('change', {
      target: {
        value: '2',
      },
    });
    const button = wrapper.find(dataQa('add-alert-rule-modal-add-button')).find('button');

    expect(button.props().disabled).toBe(false);
  });

  it('should disable the submit button if a negative duration is inserted', () => {
    const wrapper = mount(<AddAlertRuleModal setVisible={jest.fn()} isVisible alertRule={initialValues} />);
    const thresholdInput = wrapper.find(dataQa('threshold-text-input'));
    const durationInput = wrapper.find(dataQa('duration-number-input'));

    thresholdInput.simulate('change', {
      target: {
        value: '2',
      },
    });

    durationInput.simulate('change', {
      target: {
        value: '-10',
      },
    });
    const button = wrapper.find(dataQa('add-alert-rule-modal-add-button')).find('button');

    expect(button.props().disabled).toBe(true);
  });
});
