import { ReactNode } from 'react';
export interface Action {
  content: ReactNode;
  action: () => void;
  disabled?: boolean;
}

export interface MultipleActionsProps {
  actions: Action[];
  disabled?: boolean;
  dataTestId?: string;
}
