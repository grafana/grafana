import { BtnFnProps } from '@reactour/tour/dist/types';
import React from 'react';

import { Button, IconButton } from '@grafana/ui';
import usePerconaTour from 'app/percona/shared/core/hooks/tour';

const NextButton: React.FC<BtnFnProps> = () => {
  const { tour, endTour, nextStep, isLastStep } = usePerconaTour();

  return isLastStep ? (
    <Button onClick={() => tour && endTour(tour)}>Done</Button>
  ) : (
    <IconButton onClick={nextStep} name="arrow-right" size="lg" />
  );
};

export default NextButton;
