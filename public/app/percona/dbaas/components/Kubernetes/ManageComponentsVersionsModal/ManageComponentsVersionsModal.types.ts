/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { SelectableValue } from '@grafana/data';

import { Operators } from '../../DBCluster/EditDBClusterPage/DBClusterBasicOptions/DBClusterBasicOptions.types';
import { Kubernetes } from '../Kubernetes.types';

export interface ManageComponentsVersionsModalProps {
  selectedKubernetes: Kubernetes;
  isVisible: boolean;
  setVisible: (value: boolean) => void;
  setSelectedCluster: (kubernetesCluster: Kubernetes | null) => void;
}

export interface ManageComponentsVersionsRenderProps {
  operator: SelectableValue;
  component: SelectableValue;
  // used for dynamically generated attributes
  // based on operator and supported components
  [key: string]: any;
}

export interface PossibleComponentOptions {
  [Operators.pxc]?: SelectableValue[];
  [Operators.psmdb]?: SelectableValue[];
}

export enum SupportedComponents {
  pxc = 'pxc',
  haproxy = 'haproxy',
  mongod = 'mongod',
}

export enum ManageComponentVersionsFields {
  operator = 'operator',
  component = 'component',
}

export type SetComponentOptionsAction = (options: SelectableValue[]) => void;
export type SetVersionsOptionsAction = (options: SelectableValue[]) => void;
export type SetVersionsFieldNameAction = (name: string) => void;
export type SetDefaultFieldNameAction = (name: string) => void;
