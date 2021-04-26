import { DBClusterStatus } from './components/DBCluster/DBCluster.types';
import { KubernetesOperatorStatus } from './components/Kubernetes/OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { KubernetesClusterStatus } from './components/Kubernetes/KubernetesClusterStatus/KubernetesClusterStatus.types';

export const Messages = {
  tabs: {
    dbcluster: 'DB Cluster',
    kubernetes: 'Kubernetes Cluster',
  },
  kubernetes: {
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
    addModal: {
      title: 'Register Kubernetes Cluster',
      confirm: 'Register',
      fields: {
        clusterName: 'Kubernetes Cluster Name',
        kubeConfig: 'Kubeconfig file',
      },
    },
    table: {
      nameColumn: 'Kubernetes Cluster Name',
      clusterStatusColumn: 'Kubernetes Cluster Status',
      operatorsStatusColumn: 'Operators Status',
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
    },
    kubernetesStatus: {
      [KubernetesClusterStatus.ok]: 'Active',
      [KubernetesClusterStatus.unavailable]: 'Unavailable',
      [KubernetesClusterStatus.invalid]: 'Invalid',
    },
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
        clusterName: 'Cluster name should start with a letter, be alphanumeric, and may contain a dash',
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
    },
    deleteModal: {
      cancel: 'Cancel',
      confirm: 'Proceed',
      title: 'Confirm action',
    },
    editModal: {
      confirm: 'Save changes',
    },
    table: {
      nameColumn: 'Name',
      databaseTypeColumn: 'Database Type',
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
      },
      actions: {
        deleteCluster: 'Delete',
        editCluster: 'Edit',
        restartCluster: 'Restart',
        suspend: 'Suspend',
        resume: 'Resume',
        logs: 'View logs',
      },
      status: {
        [DBClusterStatus.changing]: 'Pending',
        [DBClusterStatus.deleting]: 'Deleting',
        [DBClusterStatus.failed]: 'Failed',
        [DBClusterStatus.invalid]: 'Invalid',
        [DBClusterStatus.ready]: 'Active',
        [DBClusterStatus.suspended]: 'Paused',
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
