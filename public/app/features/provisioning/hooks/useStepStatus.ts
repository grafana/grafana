import { useCallback } from 'react';

export type StepStatus = 'idle' | 'running' | 'error' | 'success';

export interface StepStatusProps {
  onStepUpdate: (status: StepStatus, error?: string) => void;
}

export interface StepStatusActions {
  setRunning: () => void;
  setError: (error: string) => void;
  setSuccess: () => void;
}

export function useStepStatus({ onStepUpdate }: StepStatusProps): StepStatusActions {
  const setRunning = useCallback(() => onStepUpdate('running'), [onStepUpdate]);
  const setError = useCallback((error: string) => onStepUpdate('error', error), [onStepUpdate]);
  const setSuccess = useCallback(() => onStepUpdate('success'), [onStepUpdate]);

  return {
    setRunning,
    setError,
    setSuccess,
  };
}
