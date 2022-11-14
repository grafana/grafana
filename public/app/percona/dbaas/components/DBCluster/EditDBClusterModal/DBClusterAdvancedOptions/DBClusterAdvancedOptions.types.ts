import { FormRenderProps } from 'react-final-form';

import { DBCluster } from '../../DBCluster.types';

export interface DBClusterAdvancedOptionsProps {
  selectedCluster: DBCluster;
  renderProps: FormRenderProps;
  setShowUnsafeConfigurationWarning: React.Dispatch<React.SetStateAction<boolean>>;
}

export enum DBClusterTopology {
  cluster = 'cluster',
  single = 'single',
}

export enum DBClusterResources {
  small = 'small',
  medium = 'medium',
  large = 'large',
  custom = 'custom',
}

export interface DBClusterDefaultResources {
  [key: string]: {
    memory: number;
    cpu: number;
    disk: number;
  };
}
