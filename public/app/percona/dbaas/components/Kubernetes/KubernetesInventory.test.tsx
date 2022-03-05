import React from 'react';
import { mount } from 'enzyme';
import { KubernetesInventory } from './KubernetesInventory';
import { useSelector } from 'react-redux';
import {
  kubernetesStub,
  addActionStub,
  deleteActionStub,
  getActionStub,
  setLoadingActionStub,
} from './__mocks__/kubernetesStubs';

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
    const root = mount(
      <KubernetesInventory
        kubernetes={kubernetesStub}
        addKubernetes={addActionStub}
        deleteKubernetes={deleteActionStub}
        getKubernetes={getActionStub}
        setLoading={setLoadingActionStub}
        loading={false}
      />
    );
    const rows = root.find('tr');
    expect(rows.length).toBe(kubernetesStub.length + 1);
  });
});
