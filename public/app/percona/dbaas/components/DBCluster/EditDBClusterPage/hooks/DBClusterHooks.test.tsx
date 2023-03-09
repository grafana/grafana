import { renderHook } from '@testing-library/react-hooks';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import { locationService } from '@grafana/runtime';

import { configureStore } from '../../../../../../store/configureStore';
import { StoreState } from '../../../../../../types';
import { Databases } from '../../../../../shared/core';
import { Kubernetes } from '../../../Kubernetes/Kubernetes.types';
import { KubernetesClusterStatus } from '../../../Kubernetes/KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesOperatorStatus } from '../../../Kubernetes/OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { DBClusterStatus } from '../../DBCluster.types';
import { dbClusterTemplatesApi } from '../../__mocks__/dbClustersStubs';
import { DBClusterResources } from '../DBClusterAdvancedOptions/DBClusterAdvancedOptions.types';
import { AddDBClusterFormValues, UpdateDBClusterFormValues } from '../EditDBClusterPage.types';

import { useEditDBClusterPageDefaultValues } from './useEditDBClusterPageDefaultValues';

const kubernetes: Kubernetes[] = [
  {
    kubernetesClusterName: 'cluster1',
    status: KubernetesClusterStatus.ok,
    operators: {
      psmdb: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
      pxc: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
    },
  },
  {
    kubernetesClusterName: 'cluster2',
    status: KubernetesClusterStatus.ok,
    operators: {
      psmdb: { status: KubernetesOperatorStatus.ok, version: '2', availableVersion: '2' },
      pxc: { status: KubernetesOperatorStatus.ok, version: '2', availableVersion: '2' },
    },
  },
];

describe('DBClusterHooks::', () => {
  it('returns default values for create mode', () => {
    // @ts-ignore
    const wrapper = ({ children }) => (
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: {
              loading: false,
              result: { dbaasEnabled: true },
            },
          },
        } as StoreState)}
      >
        <Router history={locationService.getHistory()}>{children}</Router>
      </Provider>
    );
    const { result } = renderHook(() => useEditDBClusterPageDefaultValues({ kubernetes, mode: 'create' }), { wrapper });
    const initialValues = result.current[0] as AddDBClusterFormValues;

    expect(initialValues).toEqual(
      expect.objectContaining({
        databaseType: expect.objectContaining({ value: 'mongodb' }),
        name: expect.stringContaining('mongodb'),
        kubernetesCluster: expect.objectContaining({ value: 'cluster1' }),
      })
    );
  });

  it('returns default values from kubernetesPage for create mode', () => {
    // @ts-ignore
    const wrapper = ({ children }) => (
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: {
              loading: false,
              result: { dbaasEnabled: true },
            },
            dbaas: {
              selectedKubernetesCluster: kubernetes[1],
            },
          },
        } as StoreState)}
      >
        <Router history={locationService.getHistory()}>{children}</Router>
      </Provider>
    );
    const { result } = renderHook(() => useEditDBClusterPageDefaultValues({ kubernetes, mode: 'create' }), { wrapper });
    const initialValues = result.current[0] as AddDBClusterFormValues;

    expect(initialValues).toEqual(
      expect.objectContaining({
        databaseType: expect.objectContaining({ value: 'mongodb' }),
        name: expect.stringContaining('mongodb'),
        kubernetesCluster: expect.objectContaining({ value: 'cluster2' }),
      })
    );
  });

  it('returns default values for edit mode', () => {
    // @ts-ignore
    const wrapper = ({ children }) => (
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: {
              loading: false,
              result: { dbaasEnabled: true },
            },
            dbaas: {
              selectedDBCluster: {
                clusterName: 'cluster_2',
                kubernetesClusterName: 'cluster_2',
                databaseType: 'mysql',
                clusterSize: 1,
                memory: 1001,
                cpu: 1002,
                disk: 1003,
                status: DBClusterStatus.unknown,
                message: 'Error',
                template: dbClusterTemplatesApi[0],
              },
            },
          },
        } as StoreState)}
      >
        <Router history={locationService.getHistory()}>{children}</Router>
      </Provider>
    );
    const { result } = renderHook(() => useEditDBClusterPageDefaultValues({ kubernetes, mode: 'edit' }), { wrapper });
    const initialValues = result.current[0] as UpdateDBClusterFormValues;
    expect(initialValues).toEqual(
      expect.objectContaining({
        databaseType: expect.objectContaining({ value: Databases.mysql }),
        memory: 1001,
        cpu: 1002,
        disk: 1003,
        nodes: 1,
        resources: DBClusterResources.custom,
        template: expect.objectContaining({ value: dbClusterTemplatesApi[0].kind }),
      })
    );
  });
});
