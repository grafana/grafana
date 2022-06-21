import { shallow } from 'enzyme';
import React from 'react';

import PageWrapper from '../shared/components/PageWrapper/PageWrapper';

import IntegratedAlertingPage from './IntegratedAlertingPage';

describe('IntegratedAlertingPage', () => {
  it('renders PageWrapper', () => {
    const wrapper = shallow(<IntegratedAlertingPage />);
    expect(wrapper.find(PageWrapper).exists()).toBeTruthy();
  });
});
