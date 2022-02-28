import React from 'react';
import { shallow } from 'enzyme';
import { useSelector } from 'react-redux';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';
import { DBaaS } from './DBaaS';

jest.mock('app/core/app_events');
jest.mock('./components/Kubernetes/Kubernetes.hooks');
jest.mock('react-redux', () => {
  const original = jest.requireActual('react-redux');
  return {
    ...original,
    useSelector: jest.fn(),
  };
});

describe('DBaaS::', () => {
  beforeEach(() => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({ perconaUser: { isAuthorized: true }, perconaSettings: { isLoading: false } });
    });
  });

  afterEach(() => {
    (useSelector as jest.Mock).mockClear();
  });

  it('renders PageWrapper', () => {
    const wrapper = shallow(<DBaaS {...getRouteComponentProps({ match: { params: { tab: '' } } as any })} />);
    expect(wrapper.find(PageWrapper).exists()).toBeTruthy();
  });
});
