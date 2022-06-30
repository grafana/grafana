import React, { FC } from 'react';
import { IconButton } from '@grafana/ui';
import { BtnFnProps } from '@reactour/tour/dist/types';

const NextButton: FC<BtnFnProps> = ({ currentStep, setCurrentStep, stepsLength }) => (
  <IconButton
    onClick={() => setCurrentStep((step) => (step === stepsLength - 1 ? step : step + 1))}
    name="arrow-right"
    size="lg"
    disabled={currentStep === stepsLength - 1}
  />
);

export default NextButton;
