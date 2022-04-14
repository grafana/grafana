import React from 'react';
import { OperatorStatusItem } from './OperatorStatusItem';
import { Databases } from 'app/percona/shared/core';
import { KubernetesOperatorStatus } from './KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { kubernetesStub } from '../__mocks__/kubernetesStubs';
import { render } from '@testing-library/react';

describe('OperatorStatusItem::', () => {
  it('renders', () => {
    const { container } = render(
      <OperatorStatusItem
        databaseType={Databases.mysql}
        operator={{ status: KubernetesOperatorStatus.ok }}
        kubernetes={kubernetesStub[0]}
        setSelectedCluster={jest.fn()}
        setOperatorToUpdate={jest.fn()}
        setUpdateOperatorModalVisible={jest.fn()}
      />
    );

    expect(container).toHaveTextContent('PXC');
    expect(container).toHaveTextContent('Installed');
    expect(container).not.toHaveTextContent('1.8.0');
  });
  it('renders with operator version', () => {
    const operator = { status: KubernetesOperatorStatus.ok, version: '1.8.0' };
    const { container } = render(
      <OperatorStatusItem
        databaseType={Databases.mysql}
        operator={operator}
        kubernetes={kubernetesStub[0]}
        setSelectedCluster={jest.fn()}
        setOperatorToUpdate={jest.fn()}
        setUpdateOperatorModalVisible={jest.fn()}
      />
    );

    expect(container).toHaveTextContent('PXC');
    expect(container).toHaveTextContent('Installed');
    expect(container).toHaveTextContent('1.8.0');
  });
});
