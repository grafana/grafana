import { ReactNode } from 'react';
import { ResourcesWithUnits } from '../DBCluster.types';

export interface ResourcesBarProps {
  total: ResourcesWithUnits | undefined;
  allocated: ResourcesWithUnits | undefined;
  expected: ResourcesWithUnits | undefined;
  resourceLabel: string;
  icon?: ReactNode;
  dataQa?: string;
  className?: string;
}
