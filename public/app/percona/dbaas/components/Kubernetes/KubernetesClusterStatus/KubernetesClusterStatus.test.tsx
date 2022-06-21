import { shallow } from 'enzyme';
import React from 'react';

import { KubernetesClusterStatus } from './KubernetesClusterStatus';
import { KubernetesClusterStatus as Status } from './KubernetesClusterStatus.types';

describe('DBClusterStatus::', () => {
  it('renders correctly when ok', () => {
    const root = shallow(<KubernetesClusterStatus status={Status.ok} />);

    expect(root.find('[data-testid="cluster-status-ok"]')).toBeTruthy();
  });
  it('renders correctly when invalid', () => {
    const root = shallow(<KubernetesClusterStatus status={Status.invalid} />);

    expect(root.find('[data-testid="cluster-status-invalid"]')).toBeTruthy();
  });
  it('renders correctly when unavailable', () => {
    const root = shallow(<KubernetesClusterStatus status={Status.unavailable} />);

    expect(root.find('[data-testid="cluster-status-unavailable"]')).toBeTruthy();
  });
});
