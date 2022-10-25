import { BtnFnProps } from '@reactour/tour/dist/types';
import React, { FC } from 'react';

import { Button, IconButton } from '@grafana/ui';
import { setProductTourCompleted } from 'app/percona/shared/core/reducers/user/user';
import { useAppDispatch } from 'app/store/store';

const NextButton: FC<BtnFnProps> = ({ currentStep, setCurrentStep, stepsLength, setIsOpen }) => {
  const lastStep = currentStep === stepsLength - 1;
  const dispatch = useAppDispatch();

  const onDone = () => {
    setIsOpen(false);
    dispatch(setProductTourCompleted(true));
  };

  const onNext = () => setCurrentStep((step) => (step === stepsLength - 1 ? step : step + 1));

  return lastStep ? (
    <Button onClick={onDone}>Done</Button>
  ) : (
    <IconButton onClick={onNext} name="arrow-right" size="lg" />
  );
};

export default NextButton;
