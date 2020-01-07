import { ReactNode } from 'react';

export interface Tab {
  label: string;
  key: string;
  hide?: boolean;
  active?: boolean;
  icon?: ReactNode;
}
