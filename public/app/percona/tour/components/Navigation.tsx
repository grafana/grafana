import { components } from '@reactour/tour';
import { NavigationProps } from '@reactour/tour/dist/components/Navigation';
import React, { FC } from 'react';

import { useTheme2 } from '@grafana/ui';

import NextButton from './NextButton';
import PrevButton from './PrevButton';

const Navigation: FC<NavigationProps> = ({ setCurrentStep, steps, currentStep, disableDots, setIsOpen }) => {
  const theme = useTheme2();

  return (
    <components.Navigation
      setCurrentStep={setCurrentStep}
      steps={steps}
      currentStep={currentStep}
      disableDots={disableDots}
      setIsOpen={setIsOpen}
      nextButton={NextButton}
      prevButton={PrevButton}
      styles={{ dot: (base) => ({ ...base, background: theme.colors.primary.main, color: theme.colors.primary.main }) }}
    />
  );
};

export default Navigation;
