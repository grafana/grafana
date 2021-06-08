import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { dataQa } from '@percona/platform-core';
import { ChangeCheckIntervalModal } from './ChangeCheckIntervalModal';
import { CheckDetails } from 'app/percona/check/types';

jest.mock('../../../Check.service');
jest.mock('app/core/app_events', () => {
  return {
    appEvents: {
      emit: jest.fn(),
    },
  };
});

const TEST_CHECK: CheckDetails = {
  summary: 'Test',
  name: 'test',
  interval: 'STANDARD',
  description: 'test description',
  disabled: false,
};

xdescribe('ChangeCheckIntervalModal', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render modal', () => {
    let wrapper: ReactWrapper;

    act(() => {
      wrapper = mount(<ChangeCheckIntervalModal check={TEST_CHECK} setVisible={jest.fn()} isVisible />);
    });

    expect(wrapper!.find(dataQa('change-check-interval-modal')).exists()).toBeTruthy();
    expect(wrapper!.find(dataQa('change-check-interval-form')).exists()).toBeTruthy();
    expect(wrapper!.find(dataQa('change-check-interval-radio-group-wrapper')).exists()).toBeTruthy();
  });

  it('does not render the modal when visible is set to false', () => {
    let wrapper: ReactWrapper;

    act(() => {
      wrapper = mount(<ChangeCheckIntervalModal check={TEST_CHECK} setVisible={jest.fn()} isVisible={false} />);
    });

    expect(wrapper!.find(dataQa('change-check-interval-form')).length).toBe(0);
  });

  it('renders the modal when visible is set to true', () => {
    let wrapper: ReactWrapper;

    act(() => {
      wrapper = mount(<ChangeCheckIntervalModal check={TEST_CHECK} setVisible={jest.fn()} isVisible />);
    });

    expect(wrapper!.find(dataQa('change-check-interval-form')).length).toBe(1);
  });

  it('should call setVisible on close', () => {
    let wrapper: ReactWrapper;
    const setVisible = jest.fn();

    act(() => {
      wrapper = mount(<ChangeCheckIntervalModal check={TEST_CHECK} setVisible={setVisible} isVisible />);
    });

    wrapper!.find(dataQa('modal-background')).simulate('click');

    expect(setVisible).toHaveBeenCalledTimes(1);
  });

  it('should call setVisible and getAlertRuleTemplates on submit', async () => {
    let wrapper: ReactWrapper;
    const setVisible = jest.fn();

    act(() => {
      wrapper = mount(<ChangeCheckIntervalModal check={TEST_CHECK} setVisible={setVisible} isVisible />);
    });

    await act(async () => {
      wrapper.find('form').simulate('submit');
    });

    expect(setVisible).toHaveBeenCalledWith(false);
  });
});
