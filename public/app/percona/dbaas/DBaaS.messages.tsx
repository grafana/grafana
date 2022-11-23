/* eslint-disable react/display-name */
import React, { ReactNode } from 'react';

import { DBClusterStatus } from './components/DBCluster/DBCluster.types';
import { KubernetesClusterStatus } from './components/Kubernetes/KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesOperatorStatus } from './components/Kubernetes/OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';

export const Messages = {
  kubernetes: {
    noClusters: 'No clusters found',
    deleteAction: 'Unregister',
    showConfiguration: 'Show configuration',
    manageComponents: 'Manage versions',
    addAction: 'Register new Kubernetes Cluster',
    deleteModal: {
      cancel: 'Cancel',
      confirm: 'Proceed',
      confirmMessage: 'Are you sure that you want to unregister this cluster?',
      title: 'Confirm action',
      labels: {
        force: 'Ignore errors; unregister anyway',
        forceWrapper: 'Force mode',
      },
    },
    deleteSuccess: 'Cluster successfully unregistered',
    table: {
      nameColumn: 'Kubernetes Cluster Name',
      clusterStatusColumn: 'Kubernetes Cluster Status',
      operatorsColumn: 'Operators',
      actionsColumn: 'Actions',
    },
    messages: {
      clusterAdded: 'Cluster was successfully registered',
    },
    operatorStatus: {
      [KubernetesOperatorStatus.ok]: 'Installed',
      [KubernetesOperatorStatus.unsupported]: 'Not supported',
      [KubernetesOperatorStatus.unavailable]: 'How to install',
      [KubernetesOperatorStatus.invalid]: 'Invalid',
      errorMessage: 'Cluster creation failed',
      getNewVersionAvailable: (version?: string) => `(version ${version} available)`,
    },
    kubernetesStatus: {
      [KubernetesClusterStatus.ok]: 'Active',
      [KubernetesClusterStatus.unavailable]: 'Unavailable',
      [KubernetesClusterStatus.invalid]: 'Invalid',
    },
    updateOperatorModal: {
      cancel: 'Cancel',
      confirm: 'Update',
      title: 'Confirm operator update',
      buildUpdateOperatorMessage: (
        operatorType: string,
        newVersion: ReactNode,
        kubernetesClusterName: ReactNode,
        currentVersion?: string
      ) => (
        <>
          Are you sure you want to update {operatorType} {currentVersion} to version {newVersion} in{' '}
          {kubernetesClusterName} cluster?
        </>
      ),
    },
    updateOperator: 'Update',
  },
  dbcluster: {
    addAction: 'Create DB Cluster',
    publicAddressWarningBegin: 'If you want to use monitoring, you need to set your PMM installation public address in',
    publicAddressWarningLink: 'settings',
    publicAddressWarningEnd: 'before cluster creation',
    addModal: {
      title: 'Create Cluster',
      confirm: 'Create Cluster',
      fields: {
        clusterName: 'Cluster Name',
        kubernetesCluster: 'Kubernetes Cluster',
        databaseType: 'Database Type',
        databaseVersion: 'Database Version',
        topology: 'Topology',
        nodes: 'Number of Nodes',
        resources: 'Resources per Node',
        memory: 'Memory (GB)',
        cpu: 'CPU',
        disk: 'Disk (GB)',
        expose: 'External Access',
      },
      steps: {
        basicOptions: 'Basic Options',
        advancedOptions: 'Advanced Options',
      },
      topology: {
        cluster: 'Cluster',
        single: 'Single Node',
      },
      resources: {
        small: 'Small',
        medium: 'Medium',
        large: 'Large',
        custom: 'Custom',
      },
      validationMessages: {
        clusterName: 'Should start with a letter, may only contain lower case, number, dash and end with alphanumeric',
        notInstalledOperator: 'Operators must be installed to use database type',
        requiredField: 'Required field',
      },
      noOperatorsMessage: 'No clusters found with installed operators',
      resourcesBar: {
        memory: 'Memory',
        cpu: 'CPU',
        disk: 'Disk',
      },
      resourcesInfo: 'Resource calculations are an estimate',
      exposeTooltip: 'Allows external access to the database cluster',
    },
    deleteModal: {
      cancel: 'Cancel',
      confirm: 'Proceed',
      title: 'Confirm action',
    },
    editModal: {
      confirm: 'Save',
    },
    table: {
      nameColumn: 'Name',
      databaseTypeColumn: 'Database',
      connectionColumn: 'Connection',
      clusterParametersColumn: 'DB Cluster Parameters',
      clusterStatusColumn: 'Cluster Status',
      actionsColumn: 'Actions',
      connection: {
        host: 'Host',
        port: 'Port',
        username: 'Username',
        password: 'Password',
      },
      parameters: {
        clusterName: 'K8s cluster name',
        cpu: 'CPU',
        memory: 'Memory',
        disk: 'Disk',
        expose: {
          label: 'External Access',
          enabled: 'Enabled',
          disabled: 'Disabled',
        },
      },
      actions: {
        deleteCluster: 'Delete',
        editCluster: 'Edit',
        restartCluster: 'Restart',
        suspend: 'Suspend',
        resume: 'Resume',
        logs: 'View logs',
        updateCluster: 'Update',
      },
      status: {
        [DBClusterStatus.changing]: 'Pending',
        [DBClusterStatus.deleting]: 'Deleting',
        [DBClusterStatus.failed]: 'Failed',
        [DBClusterStatus.invalid]: 'Invalid',
        [DBClusterStatus.ready]: 'Active',
        [DBClusterStatus.suspended]: 'Paused',
        [DBClusterStatus.upgrading]: 'Updating',
        [DBClusterStatus.unknown]: 'Unknown',
        errorMessage: 'Cluster creation failed',
        logs: 'Logs',
        progressError: 'Error',
        processing: 'Processing',
        complete: 'Complete',
      },
    },
  },
  successfulCopyMessage: 'Copied',
  copyToClipboard: 'Copy to clipboard',
  dbaas: 'DBaaS',
};
