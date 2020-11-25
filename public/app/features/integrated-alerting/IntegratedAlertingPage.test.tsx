import { mount } from 'enzyme';
import React from 'react';

import { Messages } from './IntegratedAlerting.messages';
import IntegratedAlertingPage from './IntegratedAlertingPage';

describe('IntegratedAlertingPage', () => {
  it('should render component correctly', () => {
    const wrapper = mount(<IntegratedAlertingPage />);
    const tabs = wrapper.find('ul');

    expect(tabs.children().length).toBe(4);
    expect(tabs.find('li').at(0).text()).toEqual(Messages.tabs.alerts);
  });
});
