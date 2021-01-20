import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { dataQa } from '@percona/platform-core';
import { AddAlertRuleModal } from './AddAlertRuleModal';

// TODO: improve coverage

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
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('doesn not render the modal when visible is set to false', async () => {
    let wrapper: ReactWrapper<{}, {}, any>;

    await act(async () => {
      wrapper = mount(<AddAlertRuleModal setVisible={jest.fn()} isVisible={false} />);
    });

    expect(wrapper.find(dataQa('add-alert-rule-modal-form')).length).toBe(0);

    wrapper.unmount();
  });

  it('renders the modal when visible is set to true', async () => {
    let wrapper: ReactWrapper<{}, {}, any>;

    await act(async () => {
      wrapper = mount(<AddAlertRuleModal setVisible={jest.fn()} isVisible />);
    });

    expect(wrapper.find(dataQa('add-alert-rule-modal-form')).length).toBe(1);

    wrapper.unmount();
  });
});
