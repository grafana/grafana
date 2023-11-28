// there is a problem with exported types from react tour
// @ts-ignore
import { BtnFnProps } from '@reactour/tour/dist/types';
import React from 'react';

import { Button, IconButton } from '@grafana/ui';
import usePerconaTour from 'app/percona/shared/core/hooks/tour';

const NextButton: React.FC<React.PropsWithChildren<BtnFnProps>> = () => {
  const { tour, endTour, nextStep, isLastStep } = usePerconaTour();

  return isLastStep ? (
    <Button onClick={() => tour && endTour(tour)}>Done</Button>
  ) : (
    <IconButton aria-label='Next step' onClick={nextStep} name="arrow-right" size="lg" />
  );
};

export default NextButton;
