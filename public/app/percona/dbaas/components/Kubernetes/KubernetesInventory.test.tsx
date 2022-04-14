import React from 'react';
import { KubernetesInventory } from './KubernetesInventory';
import { useSelector } from 'react-redux';
import {
  kubernetesStub,
  addActionStub,
  deleteActionStub,
  getActionStub,
  setLoadingActionStub,
} from './__mocks__/kubernetesStubs';
import { render } from '@testing-library/react';

jest.mock('app/core/app_events');
jest.mock('./Kubernetes.hooks');
jest.mock('react-redux', () => {
  const original = jest.requireActual('react-redux');
  return {
    ...original,
    useSelector: jest.fn(),
  };
});

describe('KubernetesInventory::', () => {
  beforeEach(() => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({ perconaUser: { isAuthorized: true }, perconaSettings: { isLoading: false } });
    });
  });

  it('renders table correctly', () => {
    const { container } = render(
      <KubernetesInventory
        kubernetes={kubernetesStub}
        addKubernetes={addActionStub}
        deleteKubernetes={deleteActionStub}
        getKubernetes={getActionStub}
        setLoading={setLoadingActionStub}
        loading={false}
      />
    );
    const rows = container.querySelectorAll('tr');
    expect(rows).toHaveLength(kubernetesStub.length + 1);
  });
});
