import React from 'react';
import { shallow } from 'enzyme';
import { dataTestId } from '@percona/platform-core';
import { KubernetesOperatorStatus as Status } from '../KubernetesOperatorStatus.types';
import { OperatorStatus } from './OperatorStatus';

describe('OperatorStatus::', () => {
  it('renders correctly when active', () => {
    const root = shallow(<OperatorStatus operator={{ status: Status.ok }} />);

    expect(root.find(dataTestId('cluster-status-ok'))).toBeTruthy();
    expect(root.contains(dataTestId('operator-version-available'))).toBeFalsy();
  });

  it('renders available version when new version available and operator is installed', () => {
    const operator = { status: Status.ok, availableVersion: '1.8.0' };
    const root = shallow(<OperatorStatus operator={operator} />);

    expect(root.find(dataTestId('operator-version-available'))).toBeTruthy();
  });

  it("doesn't render available version when operator is unavailable", () => {
    const operator = { status: Status.ok, availableVersion: '1.8.0' };
    const root = shallow(<OperatorStatus operator={operator} />);

    expect(root.contains(dataTestId('operator-version-available'))).toBeFalsy();
  });
});
