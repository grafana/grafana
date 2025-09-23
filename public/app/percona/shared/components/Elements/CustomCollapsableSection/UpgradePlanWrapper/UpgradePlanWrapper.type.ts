import { ReactNode } from 'react';

export interface UpgradePlanWrapperProps {
  label: string;
  children: ReactNode;
  buttonLabel: string;
  buttonOnClick: () => void;
}
