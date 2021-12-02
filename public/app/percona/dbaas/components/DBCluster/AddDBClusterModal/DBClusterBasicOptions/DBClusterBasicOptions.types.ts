import { FormApi } from 'final-form';
import { Kubernetes } from '../../../Kubernetes/Kubernetes.types';
import { Databases } from 'app/percona/shared/core';

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

export interface KubernetesOptionProps {
  disabledOperators: Operators[];
  availableOperators: Operators[];
  kubernetesClusterName: string;
}
