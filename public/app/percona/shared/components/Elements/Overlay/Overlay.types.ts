import { ReactNode } from 'react';

export interface OverlayProps {
  children: ReactNode;
  className?: string;
  dataQa?: string;
  isPending?: boolean;
  size?: number;
}
