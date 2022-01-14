import { ReactNode } from 'react';

export interface ResourcesBarProps {
  total: number | undefined;
  allocated: number | undefined;
  expected: number | undefined;
  resourceLabel: string;
  units: string;
  icon?: ReactNode;
  dataQa?: string;
  className?: string;
}
