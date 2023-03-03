import { ReactNode } from 'react';

export interface CustomCollapsableSectionProps {
  children?: ReactNode;
  mainLabel: string;
  content: string;
  sideLabel: string;
}
