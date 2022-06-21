export enum ProgressBarStatus {
  progress = 'PROGRESS',
  error = 'ERROR',
}

export interface ProgressBarProps {
  totalSteps: number;
  finishedSteps: number;
  status: ProgressBarStatus;
  message?: string;
  dataTestId?: string;
}
