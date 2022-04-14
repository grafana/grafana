import React from 'react';
import { Databases } from 'app/percona/shared/core';
import { KubernetesOperatorStatus as Status } from './KubernetesOperatorStatus.types';
import { KubernetesOperatorStatus } from './KubernetesOperatorStatus';
import { kubernetesStub } from '../../__mocks__/kubernetesStubs';
import { render, screen } from '@testing-library/react';

describe('KubernetesOperatorStatus::', () => {
  it('renders installation link when unavailable', () => {
    render(
      <KubernetesOperatorStatus
        operator={{ status: Status.unavailable }}
        databaseType={Databases.mongodb}
        kubernetes={kubernetesStub[0]}
        setSelectedCluster={jest.fn()}
        setOperatorToUpdate={jest.fn()}
        setUpdateOperatorModalVisible={jest.fn()}
      />
    );

    expect(screen.getByTestId('cluster-link')).toBeInTheDocument();
  });

  it("doesn't render link when installed", () => {
    render(
      <KubernetesOperatorStatus
        operator={{ status: Status.ok }}
        databaseType={Databases.mongodb}
        kubernetes={kubernetesStub[0]}
        setSelectedCluster={jest.fn()}
        setOperatorToUpdate={jest.fn()}
        setUpdateOperatorModalVisible={jest.fn()}
      />
    );
    expect(screen.queryByTestId('cluster-link')).not.toBeInTheDocument();
  });

  it('renders link when available new version is available', () => {
    render(
      <KubernetesOperatorStatus
        operator={{ status: Status.ok, availableVersion: '1.4.3' }}
        databaseType={Databases.mongodb}
        kubernetes={kubernetesStub[0]}
        setSelectedCluster={jest.fn()}
        setOperatorToUpdate={jest.fn()}
        setUpdateOperatorModalVisible={jest.fn()}
      />
    );

    expect(screen.getByTestId('cluster-link')).toBeInTheDocument();
  });
});
