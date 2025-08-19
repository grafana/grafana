import { createContext, useContext, useState, useCallback, PropsWithChildren } from 'react';

import { StepStatusInfo } from './types';

interface StepStatusContextData {
  // Current status
  stepStatusInfo: StepStatusInfo;

  // Status setters
  setStepStatusInfo: (info: StepStatusInfo) => void;

  // Computed status checks
  hasStepError: boolean;
  hasStepWarning: boolean;
  isStepRunning: boolean;
  isStepSuccess: boolean;
  isStepIdle: boolean;
}

const StepStatusContext = createContext<StepStatusContextData | undefined>(undefined);

export const StepStatusProvider = ({ children }: PropsWithChildren) => {
  const [stepStatusInfo, setStepStatusInfoState] = useState<StepStatusInfo>({ status: 'idle' });

  const setStepStatusInfo = useCallback((info: StepStatusInfo) => {
    setStepStatusInfoState(info);
  }, []);

  const value: StepStatusContextData = {
    stepStatusInfo,
    setStepStatusInfo,
    hasStepError: stepStatusInfo.status === 'error',
    hasStepWarning: stepStatusInfo.status === 'warning',
    isStepRunning: stepStatusInfo.status === 'running',
    isStepSuccess: stepStatusInfo.status === 'success',
    isStepIdle: stepStatusInfo.status === 'idle',
  };

  return <StepStatusContext.Provider value={value}>{children}</StepStatusContext.Provider>;
};

export const useStepStatus = () => {
  const context = useContext(StepStatusContext);

  if (context === undefined) {
    throw new Error('useStepStatus must be used within a StepStatusProvider');
  }

  return context;
};
