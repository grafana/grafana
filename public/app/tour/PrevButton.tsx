import React, { FC } from 'react';
import { IconButton } from '@grafana/ui';
import { BtnFnProps } from '@reactour/tour/dist/types';

const PrevButton: FC<BtnFnProps> = ({ currentStep, setCurrentStep }) => (
  <IconButton
    onClick={() => setCurrentStep((step) => (step === 0 ? 0 : step - 1))}
    name="arrow-left"
    size="lg"
    disabled={currentStep === 0}
  />
);

export default PrevButton;
