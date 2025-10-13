export type WarningType = 'info' | 'warning';
export interface WarningBlockProps {
  message: string;
  type?: WarningType;
  dataTestId?: string;
  className?: string;
}
