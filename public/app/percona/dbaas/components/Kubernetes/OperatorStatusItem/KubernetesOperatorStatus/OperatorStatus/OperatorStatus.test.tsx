import React from 'react';
import { shallow } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { KubernetesOperatorStatus as Status } from '../KubernetesOperatorStatus.types';
import { OperatorStatus } from './OperatorStatus';

describe('OperatorStatus::', () => {
  it('renders correctly when active', () => {
    const root = shallow(<OperatorStatus operator={{ status: Status.ok }} />);

    expect(root.find(dataQa('cluster-status-ok'))).toBeTruthy();
    expect(root.contains(dataQa('operator-version-available'))).toBeFalsy();
  });

  it('renders available version when new version available and operator is installed', () => {
    const operator = { status: Status.ok, availableVersion: '1.8.0' };
    const root = shallow(<OperatorStatus operator={operator} />);

    expect(root.find(dataQa('operator-version-available'))).toBeTruthy();
  });

  it("doesn't render available version when operator is unavailable", () => {
    const operator = { status: Status.ok, availableVersion: '1.8.0' };
    const root = shallow(<OperatorStatus operator={operator} />);

    expect(root.contains(dataQa('operator-version-available'))).toBeFalsy();
  });
});
