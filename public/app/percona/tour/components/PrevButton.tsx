// there is a problem with exported types from react tour
// @ts-ignore
import { BtnFnProps } from '@reactour/tour/dist/types';
import React from 'react';

import { IconButton } from '@grafana/ui';
import usePerconaTour from 'app/percona/shared/core/hooks/tour';

const PrevButton: React.FC<React.PropsWithChildren<BtnFnProps>> = () => {
  const { previousStep, isFirstStep } = usePerconaTour();

  return <IconButton onClick={previousStep} aria-label='Previous step' name="arrow-left" size="lg" disabled={isFirstStep} />;
};

export default PrevButton;
