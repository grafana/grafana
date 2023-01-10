import { DBClusterPageMode } from '../../EditDBClusterPage.types';

export enum NetworkAndSecurityFields {
  expose = 'expose',
  internetFacing = 'internetFacing',
  sourceRanges = 'sourceRanges',
}

export interface NetworkAndSecurityProps {
  mode: DBClusterPageMode;
}
