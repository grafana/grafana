import React from 'react';
import { shallow } from 'enzyme';
import { KubernetesClusterStatus as Status } from './KubernetesClusterStatus.types';
import { KubernetesClusterStatus } from './KubernetesClusterStatus';

describe('DBClusterStatus::', () => {
  it('renders correctly when ok', () => {
    const root = shallow(<KubernetesClusterStatus status={Status.ok} />);

    expect(root.find('[data-qa="cluster-status-ok"]')).toBeTruthy();
  });
  it('renders correctly when invalid', () => {
    const root = shallow(<KubernetesClusterStatus status={Status.invalid} />);

    expect(root.find('[data-qa="cluster-status-invalid"]')).toBeTruthy();
  });
  it('renders correctly when unavailable', () => {
    const root = shallow(<KubernetesClusterStatus status={Status.unavailable} />);

    expect(root.find('[data-qa="cluster-status-unavailable"]')).toBeTruthy();
  });
});
