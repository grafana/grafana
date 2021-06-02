import React from 'react';
import { shallow } from 'enzyme';
import IntegratedAlertingPage from './IntegratedAlertingPage';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';

describe('IntegratedAlertingPage', () => {
  it('renders PageWrapper', () => {
    const wrapper = shallow(<IntegratedAlertingPage />);
    expect(wrapper.find(PageWrapper).exists()).toBeTruthy();
  });
});
