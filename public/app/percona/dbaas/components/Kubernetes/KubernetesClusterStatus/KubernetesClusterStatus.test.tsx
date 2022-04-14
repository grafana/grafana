import React from 'react';
import { KubernetesClusterStatus as Status } from './KubernetesClusterStatus.types';
import { KubernetesClusterStatus } from './KubernetesClusterStatus';
import { render, screen } from '@testing-library/react';

describe('DBClusterStatus::', () => {
  it('renders correctly when ok', () => {
    render(<KubernetesClusterStatus status={Status.ok} />);

    expect(screen.getByTestId('cluster-status-ok')).toBeInTheDocument();
  });
  it('renders correctly when invalid', () => {
    render(<KubernetesClusterStatus status={Status.invalid} />);

    expect(screen.getByTestId('cluster-status-invalid')).toBeInTheDocument();
  });
  it('renders correctly when unavailable', () => {
    render(<KubernetesClusterStatus status={Status.unavailable} />);

    expect(screen.getByTestId('cluster-status-unavailable')).toBeInTheDocument();
  });
});
