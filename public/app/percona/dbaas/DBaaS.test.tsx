import React from 'react';
import { mount } from 'enzyme';
import { DBaaS } from './DBaaS';
import { useSelector } from 'react-redux';

jest.mock('app/core/app_events');
jest.mock('./components/Kubernetes/Kubernetes.hooks');
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getLocationSrv: jest.fn().mockImplementation(() => ({ update: fakeLocationUpdate })),
}));

describe('DBaaS::', () => {
  beforeEach(() => {
    console.error = jest.fn();
    (useSelector as jest.Mock).mockImplementation(callback => {
      return callback({ location: { routeParams: { tab: 'alerts' }, path: '/integrated-alerting/alerts' } });
    });
  });
  it('renders tabs correctly', () => {
    const root = mount(<DBaaS />);
    const tabs = root.find('ul');

    expect(tabs.children().length).toBe(2);
  });
});
