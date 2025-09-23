import { ReactNode } from 'react';

export interface OverlayProps {
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
  dataTestId?: string;
  isPending?: boolean;
  size?: number;
}
