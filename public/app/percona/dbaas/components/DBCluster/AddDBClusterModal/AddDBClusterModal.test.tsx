import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { dataTestId } from '@percona/platform-core';
import { AddDBClusterModal } from './AddDBClusterModal';
import { setVisibleStub, onDBClusterAddedStub } from './__mocks__/addDBClusterModalStubs';
import { kubernetesStub } from '../../Kubernetes/__mocks__/kubernetesStubs';

jest.mock('app/core/app_events');

xdescribe('AddDBClusterModal::', () => {
  const openStep = (root: ReactWrapper, step: string) => {
    root.find(`[data-testid="${step}"]`).find('[data-testid="step-header"]').simulate('click');
  };

  const isStepActive = (root: ReactWrapper, step: string) =>
    root
      .find(`[data-testid="${step}"]`)
      .find('[data-testid="step-content"]')
      .find('div')
      .at(1)
      .prop('className')
      ?.includes('current');

  it('renders correctly', () => {
    const root = mount(
      <AddDBClusterModal
        kubernetes={kubernetesStub}
        isVisible
        setVisible={setVisibleStub}
        onDBClusterAdded={onDBClusterAddedStub}
        showMonitoringWarning={false}
      />
    );

    expect(root.find('form')).toBeTruthy();
    expect(root.find('[data-testid="name-text-input"]')).toBeTruthy();
    expect(root.find('[data-testid="dbcluster-kubernetes-cluster-field"]')).toBeTruthy();
    expect(root.find('[data-testid="dbcluster-database-type-field"]')).toBeTruthy();
    expect(root.find('[data-testid="step-progress-submit-button"]')).toBeTruthy();
    expect(root.find('[data-testid="dbcluster-basic-options-step"]')).toBeTruthy();
    expect(root.find('[data-testid="dbcluster-advanced-options-step"]')).toBeTruthy();
    expect(root.find('[data-testid="dbcluster-advanced-options-step"]')).toBeTruthy();
    expect(root.find(dataTestId('add-cluster-monitoring-warning'))).toBeTruthy();
  });

  it('should disable submit button when there is no values', () => {
    const root = mount(
      <AddDBClusterModal
        kubernetes={kubernetesStub}
        isVisible
        setVisible={setVisibleStub}
        onDBClusterAdded={onDBClusterAddedStub}
      />
    );

    openStep(root, 'dbcluster-advanced-options-step');

    const button = root.find('[data-testid="step-progress-submit-button"]').find('button');

    expect(button.prop('disabled')).toBeTruthy();
  });

  it('should change step correctly', () => {
    const root = mount(
      <AddDBClusterModal
        kubernetes={kubernetesStub}
        isVisible
        setVisible={setVisibleStub}
        onDBClusterAdded={onDBClusterAddedStub}
      />
    );

    expect(isStepActive(root, 'dbcluster-basic-options-step')).toBeTruthy();
    openStep(root, 'dbcluster-advanced-options-step');
    expect(isStepActive(root, 'dbcluster-advanced-options-step')).toBeTruthy();
    expect(isStepActive(root, 'dbcluster-basic-options-step')).toBeFalsy();
  });
});
