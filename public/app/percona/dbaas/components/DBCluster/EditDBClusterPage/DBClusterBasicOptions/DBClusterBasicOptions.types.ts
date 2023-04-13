import { FormApi } from 'final-form';

import { Databases } from 'app/percona/shared/core';

import { Kubernetes, OperatorsList } from '../../../Kubernetes/Kubernetes.types';

export interface DBClusterBasicOptionsProps {
  kubernetes: Kubernetes[];
  form: FormApi;
}

export enum Operators {
  pxc = 'pxc',
  psmdb = 'psmdb',
}

export interface DatabaseOption {
  value: Databases;
  label: string;
}

export interface DatabaseOptionInitial {
  value?: Databases;
  label?: string;
}

export interface KubernetesOptionProps {
  disabledOperators: Operators[];
  availableOperators: Operators[];
  kubernetesClusterName: string;
}

export interface KubernetesOption {
  value: string;
  label: JSX.Element;
  operators: OperatorsList;
  availableOperators: Operators[];
}

export enum BasicOptionsFields {
  name = 'name',
  kubernetesCluster = 'kubernetesCluster',
  databaseType = 'databaseType',
  databaseVersion = 'databaseVersion',
}

export interface BasicOptionsFieldsProps {
  [BasicOptionsFields.name]?: string;
  [BasicOptionsFields.kubernetesCluster]?: KubernetesOption;
  [BasicOptionsFields.databaseType]?: DatabaseOptionInitial;
  [BasicOptionsFields.databaseVersion]?: string;
}
