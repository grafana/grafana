import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { dataQa } from '@percona/platform-core';
import { AddAlertRuleModal } from './AddAlertRuleModal';
import { rulesStubs } from '../__mocks__/alertRulesStubs';
import { formatRule } from '../AlertRules.utils';
import { Messages } from './AddAlertRuleModal.messages';

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

  it('renders new rule fields', async () => {
    let wrapper: ReactWrapper<{}, {}, any>;

    await act(async () => {
      wrapper = mount(<AddAlertRuleModal alertRule={undefined} setVisible={jest.fn()} isVisible />);
    });

    expect(wrapper.find(dataQa('name-text-input'))).toHaveLength(1);
    expect(wrapper.find(dataQa('threshold-text-input'))).toHaveLength(1);
    expect(
      wrapper
        .find(dataQa('add-alert-rule-modal-add-button'))
        .at(0)
        .text()
    ).toBe(Messages.create);
  });

  it('renders edit fields', async () => {
    let wrapper: ReactWrapper<{}, {}, any>;

    await act(async () => {
      wrapper = mount(<AddAlertRuleModal alertRule={formatRule(rulesStubs[0])} setVisible={jest.fn()} isVisible />);
    });

    expect(wrapper.find(dataQa('name-text-input'))).toHaveLength(0);
    expect(wrapper.find(dataQa('threshold-text-input'))).toHaveLength(1);
    expect(
      wrapper
        .find(dataQa('add-alert-rule-modal-add-button'))
        .at(0)
        .text()
    ).toBe(Messages.update);
  });

  it('doesn not render the modal when visible is set to false', async () => {
    let wrapper: ReactWrapper<{}, {}, any>;

    await act(async () => {
      wrapper = mount(
        <AddAlertRuleModal alertRule={formatRule(rulesStubs[0])} setVisible={jest.fn()} isVisible={false} />
      );
    });

    expect(wrapper.find(dataQa('add-alert-rule-modal-form')).length).toBe(0);

    wrapper.unmount();
  });

  it('renders the modal when visible is set to true', async () => {
    let wrapper: ReactWrapper<{}, {}, any>;

    await act(async () => {
      wrapper = mount(<AddAlertRuleModal alertRule={formatRule(rulesStubs[0])} setVisible={jest.fn()} isVisible />);
    });

    expect(wrapper.find(dataQa('add-alert-rule-modal-form')).length).toBe(1);

    wrapper.unmount();
  });

  it('closes the modal when the user clicks on the backdrop', async () => {
    let wrapper: ReactWrapper<{}, {}, any>;
    const fakeSetVisible = jest.fn();

    await act(async () => {
      wrapper = mount(
        <AddAlertRuleModal alertRule={formatRule(rulesStubs[0])} setVisible={fakeSetVisible} isVisible />
      );
    });

    wrapper.find(dataQa('modal-background')).simulate('click');

    expect(fakeSetVisible).toHaveBeenCalledTimes(1);
  });

  it('closes the modal when the user clicks on the cancel button', async () => {
    let wrapper: ReactWrapper<{}, {}, any>;
    const fakeSetVisible = jest.fn();

    await act(async () => {
      wrapper = mount(
        <AddAlertRuleModal alertRule={formatRule(rulesStubs[0])} setVisible={fakeSetVisible} isVisible />
      );
    });

    wrapper
      .find(dataQa('add-alert-rule-modal-cancel-button'))
      .at(0)
      .simulate('click');

    expect(fakeSetVisible).toHaveBeenCalledTimes(1);
  });
});
