import { mount } from 'enzyme';
import React from 'react';

import { Databases } from 'app/percona/shared/core';

import { kubernetesStub } from '../__mocks__/kubernetesStubs';

import { KubernetesOperatorStatus } from './KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { OperatorStatusItem } from './OperatorStatusItem';

describe('OperatorStatusItem::', () => {
  it('renders', () => {
    const root = mount(
      <OperatorStatusItem
        databaseType={Databases.mysql}
        operator={{ status: KubernetesOperatorStatus.ok }}
        kubernetes={kubernetesStub[0]}
        setSelectedCluster={jest.fn()}
        setOperatorToUpdate={jest.fn()}
        setUpdateOperatorModalVisible={jest.fn()}
      />
    );

    expect(root.text()).toContain('PXC');
    expect(root.text()).toContain('Installed');
    expect(root.text()).not.toContain('1.8.0');
  });
  it('renders with operator version', () => {
    const operator = { status: KubernetesOperatorStatus.ok, version: '1.8.0' };
    const root = mount(
      <OperatorStatusItem
        databaseType={Databases.mysql}
        operator={operator}
        kubernetes={kubernetesStub[0]}
        setSelectedCluster={jest.fn()}
        setOperatorToUpdate={jest.fn()}
        setUpdateOperatorModalVisible={jest.fn()}
      />
    );

    expect(root.text()).toContain('PXC');
    expect(root.text()).toContain('Installed');
    expect(root.text()).toContain('1.8.0');
  });
});
