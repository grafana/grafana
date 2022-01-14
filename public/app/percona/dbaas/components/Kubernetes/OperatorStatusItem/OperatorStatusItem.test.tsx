import React from 'react';
import { mount } from 'enzyme';
import { OperatorStatusItem } from './OperatorStatusItem';
import { Databases } from 'app/percona/shared/core';
import { KubernetesOperatorStatus } from './KubernetesOperatorStatus/KubernetesOperatorStatus.types';

describe('DBClusterConnectionItem::', () => {
  it('renders', () => {
    const root = mount(<OperatorStatusItem databaseType={Databases.mysql} status={KubernetesOperatorStatus.ok} />);

    expect(root.text()).toContain('MySQL');
    expect(root.text()).toContain('Installed');
  });
});
