import React from 'react';
import { mount } from 'enzyme';
import { DBaaS } from './DBaaS';

jest.mock('app/core/app_events');
jest.mock('./components/Kubernetes/Kubernetes.hooks');

describe('DBaaS::', () => {
  it('renders tabs correctly', () => {
    const root = mount(<DBaaS />);
    const tabs = root.find('ul');

    expect(tabs.children().length).toBe(2);
  });
});
