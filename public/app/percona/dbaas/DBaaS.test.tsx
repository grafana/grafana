import React from 'react';
import { shallow } from 'enzyme';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';
import { DBaaS } from './DBaaS';

jest.mock('app/core/app_events');
jest.mock('./components/Kubernetes/Kubernetes.hooks');

describe('DBaaS::', () => {
  it('renders PageWrapper', () => {
    const wrapper = shallow(<DBaaS />);
    expect(wrapper.find(PageWrapper).exists()).toBeTruthy();
  });
});
