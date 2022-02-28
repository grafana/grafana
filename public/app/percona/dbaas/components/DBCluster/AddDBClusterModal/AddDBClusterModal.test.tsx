import React from 'react';
import { AddDBClusterModal } from './AddDBClusterModal';
import { setVisibleStub, onDBClusterAddedStub } from './__mocks__/addDBClusterModalStubs';
import { kubernetesStub } from '../../Kubernetes/__mocks__/kubernetesStubs';
import { render, fireEvent, screen } from '@testing-library/react';

jest.mock('app/core/app_events');

describe('AddDBClusterModal::', () => {
  const openStep = (step: string) => {
    const stepNode = screen.getByTestId(`${step}`).querySelector('[data-testid="step-header"]');
    if (stepNode) {
      fireEvent.click(stepNode);
    }
  };

  const isStepActive = (step: string) => {
    const stepNode = screen.getByTestId(`${step}`).querySelector('[data-testid="step-content"]');
    return stepNode ? stepNode.getElementsByTagName('div')[0].className.split('-')?.includes('current') : false;
  };

  it('renders correctly', () => {
    render(
      <AddDBClusterModal
        kubernetes={kubernetesStub}
        isVisible
        setVisible={setVisibleStub}
        onDBClusterAdded={onDBClusterAddedStub}
        showMonitoringWarning={false}
      />
    );

    expect(screen.findByRole('form')).toBeTruthy();
    expect(screen.getByTestId('name-text-input')).toBeTruthy();
    expect(screen.getByTestId('dbcluster-kubernetes-cluster-field')).toBeTruthy();
    expect(screen.getByTestId('dbcluster-database-type-field')).toBeTruthy();
    expect(screen.getByTestId('step-progress-submit-button')).toBeTruthy();
    expect(screen.getByTestId('dbcluster-basic-options-step')).toBeTruthy();
    expect(screen.getByTestId('dbcluster-advanced-options-step')).toBeTruthy();
    expect(screen.getByTestId('dbcluster-advanced-options-step')).toBeTruthy();
    expect(screen.findByTestId('add-cluster-monitoring-warning')).toBeTruthy();
  });

  it('should disable submit button when there is no values', () => {
    render(
      <AddDBClusterModal
        kubernetes={kubernetesStub}
        isVisible
        setVisible={setVisibleStub}
        onDBClusterAdded={onDBClusterAddedStub}
      />
    );

    openStep('dbcluster-advanced-options-step');

    const button = screen.getByTestId('step-progress-submit-button');
    expect(button).toBeDisabled();
  });

  it('should change step correctly', () => {
    render(
      <AddDBClusterModal
        kubernetes={kubernetesStub}
        isVisible
        setVisible={setVisibleStub}
        onDBClusterAdded={onDBClusterAddedStub}
      />
    );

    expect(isStepActive('dbcluster-basic-options-step')).toBeTruthy();
    openStep('dbcluster-advanced-options-step');
    expect(isStepActive('dbcluster-advanced-options-step')).toBeTruthy();
    expect(isStepActive('dbcluster-basic-options-step')).toBeFalsy();
  });
});
