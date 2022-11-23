import { useTour } from '@reactour/tour';
import { useCallback, useEffect, useMemo } from 'react';

import * as TourActions from 'app/percona/shared/core/reducers/tour';
import { TourStep, TourType } from 'app/percona/shared/core/reducers/tour';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { waitForVisible } from '../../helpers/observer';
import { getTour } from '../selectors';

const usePerconaTour = () => {
  const dispatch = useAppDispatch();
  const { steps, tour } = useSelector(getTour);
  const reactTour = useTour();
  const tourSteps = useMemo(() => (tour ? steps[tour] : []), [tour, steps]);

  useEffect(() => {
    reactTour.setSteps(tour ? steps[tour] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, tour]);

  const setSteps = useCallback(
    (tour: TourType, steps: TourStep[]) => {
      dispatch(TourActions.setSteps({ tour, steps }));
    },
    [dispatch]
  );

  const startTour = useCallback(
    async (tour: TourType) => {
      const firstStep = steps[tour][0];

      // wait for the first step element to visible
      if (firstStep?.selector) {
        await waitForVisible(firstStep.selector);
      }
      dispatch(TourActions.startTour(tour));
      reactTour.setIsOpen(true);
      reactTour.setCurrentStep(0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [steps, dispatch]
  );

  const endTour = useCallback(
    (tour: TourType) => {
      dispatch(TourActions.endTourAction(tour));
      reactTour.setIsOpen(false);
      reactTour.setCurrentStep(0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch]
  );

  const nextStep = useCallback(() => {
    reactTour.setCurrentStep((step: number) => (step === reactTour.steps.length - 1 ? step : step + 1));
  }, [reactTour]);

  const previousStep = useCallback(() => {
    reactTour.setCurrentStep((step: number) => (step === 0 ? 0 : step - 1));
  }, [reactTour]);

  return {
    tour,
    isOpen: reactTour.isOpen,
    steps: tourSteps,
    currentStep: reactTour.currentStep,
    navMenuId: tourSteps[reactTour.currentStep]?.navMenuId,
    setSteps,
    startTour,
    endTour,
    nextStep,
    previousStep,
    isFirstStep: reactTour.currentStep === 0,
    isLastStep: reactTour.currentStep === tourSteps.length - 1,
  };
};

export default usePerconaTour;
