import { type PropsWithChildren, createContext, memo, useCallback, useContext, useState } from 'react';

import { getWizardSteps } from './steps';
import { StepKey, StepState, type VisitedSteps } from './types';

interface StepperStateContextValue {
  /** Mark a step as visited */
  setVisitedStep: (id: StepKey) => void;
  /** Map of step IDs to their visited state */
  visitedSteps: VisitedSteps;
  /** Current active step */
  activeStep: StepKey;
  /** Set the active step */
  setActiveStep: (step: StepKey) => void;
  /** Check if a step is completed (has all required data) */
  isStepCompleted: (step: StepKey) => boolean;
  /** Mark a step as completed */
  setStepCompleted: (step: StepKey, completed: boolean) => void;
  /** Check if a step was skipped */
  isStepSkipped: (step: StepKey) => boolean;
  /** Mark a step as skipped */
  setStepSkipped: (step: StepKey, skipped: boolean) => void;
  /** Check if a step has validation errors */
  hasStepErrors: (step: StepKey) => boolean;
  /** Set step validation error state */
  setStepErrors: (step: StepKey, hasErrors: boolean) => void;
}

const StepperStateContext = createContext<StepperStateContextValue | null>(null);

interface StepperStateProviderProps extends PropsWithChildren {
  initialStep?: StepKey;
}

export const StepperStateProvider = memo<StepperStateProviderProps>(
  ({ children, initialStep = StepKey.Notifications }) => {
    const [activeStep, setActiveStep] = useState<StepKey>(initialStep);
    const [visitedSteps, setVisitedSteps] = useState<VisitedSteps>({
      [StepKey.Notifications]: StepState.Idle,
      [StepKey.Rules]: StepState.Idle,
      [StepKey.Review]: StepState.Idle,
    });
    const [completedSteps, setCompletedSteps] = useState<Partial<Record<StepKey, boolean>>>({});
    // Steps before the one the wizard opens on count as skipped, so the sidebar still lets the user move
    // forward from there. Nothing from a skipped step is imported.
    const [skippedSteps, setSkippedSteps] = useState<Partial<Record<StepKey, boolean>>>(() =>
      getSkippedStepsBefore(initialStep)
    );
    const [errorSteps, setErrorSteps] = useState<Partial<Record<StepKey, boolean>>>({});

    const setVisitedStep = useCallback((id: StepKey) => {
      setVisitedSteps((prev) => ({ ...prev, [id]: StepState.Visited }));
    }, []);

    const isStepCompleted = useCallback(
      (step: StepKey) => {
        return completedSteps[step] === true;
      },
      [completedSteps]
    );

    const setStepCompleted = useCallback((step: StepKey, completed: boolean) => {
      setCompletedSteps((prev) => ({ ...prev, [step]: completed }));
    }, []);

    const isStepSkipped = useCallback(
      (step: StepKey) => {
        return skippedSteps[step] === true;
      },
      [skippedSteps]
    );

    const setStepSkipped = useCallback((step: StepKey, skipped: boolean) => {
      setSkippedSteps((prev) => ({ ...prev, [step]: skipped }));
    }, []);

    const hasStepErrors = useCallback(
      (step: StepKey) => {
        return errorSteps[step] === true;
      },
      [errorSteps]
    );

    const setStepErrors = useCallback((step: StepKey, hasErrors: boolean) => {
      setErrorSteps((prev) => ({ ...prev, [step]: hasErrors }));
    }, []);

    return (
      <StepperStateContext.Provider
        value={{
          setVisitedStep,
          visitedSteps,
          activeStep,
          setActiveStep,
          isStepCompleted,
          setStepCompleted,
          isStepSkipped,
          setStepSkipped,
          hasStepErrors,
          setStepErrors,
        }}
      >
        {children}
      </StepperStateContext.Provider>
    );
  }
);

StepperStateProvider.displayName = 'StepperStateProvider';

function getSkippedStepsBefore(step: StepKey): Partial<Record<StepKey, boolean>> {
  const stepIds = getWizardSteps().map(({ id }) => id);
  const earlierSteps = stepIds.slice(0, Math.max(stepIds.indexOf(step), 0));
  return Object.fromEntries(earlierSteps.map((id) => [id, true]));
}

export const useStepperState = (): StepperStateContextValue => {
  const context = useContext(StepperStateContext);

  if (context == null) {
    throw new Error('You can only use `useStepperState` in a component wrapped in a `StepperStateProvider`.');
  }

  return context;
};
