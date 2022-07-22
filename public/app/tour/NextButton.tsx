import { BtnFnProps } from '@reactour/tour/dist/types';
import React, { FC } from 'react';
import { useLocalStorage } from 'react-use';

import { Button, IconButton } from '@grafana/ui';

import { PERCONA_TOUR_FLAG } from './constants';

const NextButton: FC<BtnFnProps> = ({ currentStep, setCurrentStep, stepsLength, setIsOpen }) => {
  const lastStep = currentStep === stepsLength - 1;
  const [, setShowTour] = useLocalStorage<boolean>(PERCONA_TOUR_FLAG, true);

  const onDone = () => {
    setIsOpen(false);
    setShowTour(false);
  };

  const onNext = () => setCurrentStep((step) => (step === stepsLength - 1 ? step : step + 1));

  return lastStep ? (
    <Button onClick={onDone}>Done</Button>
  ) : (
    <IconButton onClick={onNext} name="arrow-right" size="lg" />
  );
};

export default NextButton;
