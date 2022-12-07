import React, { ReactElement } from 'react';

import { PluginRecipeSetupDashboardStep } from '../types';

type Props = {
  step: PluginRecipeSetupDashboardStep;
};

export function StepSetupDashboard({ step }: Props): ReactElement {
  return <div>Dashboard step</div>;
}
