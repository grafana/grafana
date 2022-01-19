import React from 'react';
import { shallow } from 'enzyme';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';
import { DBaaS } from './DBaaS';

jest.mock('app/core/app_events');
jest.mock('./components/Kubernetes/Kubernetes.hooks');

describe('DBaaS::', () => {
  it('renders PageWrapper', () => {
    const wrapper = shallow(<DBaaS {...getRouteComponentProps({ match: { params: { tab: '' } } as any })} />);
    expect(wrapper.find(PageWrapper).exists()).toBeTruthy();
  });
});
