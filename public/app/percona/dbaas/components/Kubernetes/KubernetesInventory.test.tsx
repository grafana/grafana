import React from 'react';
import { mount } from 'enzyme';
import { KubernetesInventory } from './KubernetesInventory';
import {
  kubernetesStub,
  addActionStub,
  deleteActionStub,
  getActionStub,
  setLoadingActionStub,
} from './__mocks__/kubernetesStubs';

jest.mock('app/core/app_events');
jest.mock('./Kubernetes.hooks');

describe('KubernetesInventory::', () => {
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
