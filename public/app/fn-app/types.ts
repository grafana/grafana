import { FunctionComponent } from 'react';
export interface FNDashboardProps {
  uid: string;
  slug: string;
  controlsContainer: HTMLElement | undefined;
  theme: string;
  fnError: FunctionComponent;
  hiddenVariables: string[];
}
