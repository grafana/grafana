import { BtnFnProps } from '@reactour/tour/dist/types';
import React from 'react';

import { IconButton } from '@grafana/ui';
import usePerconaTour from 'app/percona/shared/core/hooks/tour';

const PrevButton: React.FC<BtnFnProps> = () => {
  const { previousStep, isFirstStep } = usePerconaTour();

  return <IconButton onClick={previousStep} name="arrow-left" size="lg" disabled={isFirstStep} />;
};

export default PrevButton;
