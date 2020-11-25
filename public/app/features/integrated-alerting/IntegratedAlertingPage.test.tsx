import React from 'react';
import { mount } from 'enzyme';
import IntegratedAlertingPage from './IntegratedAlertingPage';
import { Messages } from './IntegratedAlerting.messages';

describe('IntegratedAlertingPage', () => {
  it('should render component correctly', () => {
    const wrapper = mount(<IntegratedAlertingPage />);
    const tabs = wrapper.find('ul');

    expect(tabs.children().length).toBe(4);
    expect(
      tabs
        .find('li')
        .at(0)
        .text()
    ).toEqual(Messages.tabs.alerts);
  });
});
