import { ReactElement } from 'react';

// these are not available yet in grafana
export type CustomMethodId = `custom-${string}`;

export type CustomMethod = {
  id: CustomMethodId;
  label: string;
  description: string;
  component: ReactElement;
};
