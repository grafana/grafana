import React, { ReactElement } from 'react';

import { PluginRecipeStep, SetupDashboardStepSettings } from '../types';

type Props = {
  step: PluginRecipeStep<SetupDashboardStepSettings>;
};

export function StepSetupDashboard({ step }: Props): ReactElement {
  return <div>Dashboard step</div>;
}
