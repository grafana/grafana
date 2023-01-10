/* eslint-disable @typescript-eslint/no-explicit-any */
import { SelectableValue } from '@grafana/data/src';

import { Kubernetes } from '../../Kubernetes/Kubernetes.types';

import { ConfigurationFields } from './DBClusterAdvancedOptions/Configurations/Configurations.types';
import { AdvancedOptionsFields, DBClusterResources } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions.types';
import { NetworkAndSecurityFields } from './DBClusterAdvancedOptions/NetworkAndSecurity/NetworkAndSecurity.types';
import {
  BasicOptionsFields,
  DatabaseOptionInitial,
  KubernetesOption,
} from './DBClusterBasicOptions/DBClusterBasicOptions.types';

export type DBClusterPageMode = 'create' | 'edit' | 'list';

export interface EditDBClusterPageProps {
  kubernetes: Kubernetes[];
}

export interface AddDBClusterFormValues {
  [AdvancedOptionsFields.nodes]: number;
  [AdvancedOptionsFields.resources]: DBClusterResources;
  [AdvancedOptionsFields.memory]: number;
  [AdvancedOptionsFields.cpu]: number;
  [AdvancedOptionsFields.disk]: number;
  [BasicOptionsFields.databaseType]?: DatabaseOptionInitial;
  [BasicOptionsFields.kubernetesCluster]?: KubernetesOption;
  [BasicOptionsFields.name]?: string;
  [ConfigurationFields.configuration]?: string;
  [ConfigurationFields.storageClass]?: SelectableValue<string>;
  [NetworkAndSecurityFields.expose]?: boolean;
  [NetworkAndSecurityFields.sourceRanges]?: Array<{}> | [];
  [NetworkAndSecurityFields.internetFacing]?: boolean;
}

export interface UpdateDBClusterFormValues {
  [AdvancedOptionsFields.resources]?: DBClusterResources;
  [AdvancedOptionsFields.nodes]: number;
  [BasicOptionsFields.databaseType]: SelectableValue;
  [AdvancedOptionsFields.cpu]: number;
  [AdvancedOptionsFields.disk]: number;
  [AdvancedOptionsFields.memory]: number;
  [ConfigurationFields.configuration]?: string;
  [ConfigurationFields.storageClass]?: SelectableValue<string>;
  [ConfigurationFields.configuration]?: string;
  [NetworkAndSecurityFields.expose]?: boolean;
  [NetworkAndSecurityFields.sourceRanges]?: Array<{}> | [];
  [NetworkAndSecurityFields.internetFacing]?: boolean;
}

export interface DBClusterFormSubmitProps {
  mode: DBClusterPageMode;
  showPMMAddressWarning: boolean;
}

export type ClusterSubmit = (values: Record<string, any>) => Promise<void>;
