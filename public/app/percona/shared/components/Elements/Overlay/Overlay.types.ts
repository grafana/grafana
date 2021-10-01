import { ReactNode } from 'react';

export interface OverlayProps {
  children: ReactNode;
  className?: string;
  dataTestId?: string;
  isPending?: boolean;
  size?: number;
}
