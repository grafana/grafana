import React, { ReactElement } from 'react';

import { InstallPluginStepSettings, PluginRecipeStep } from '../types';

type Props = {
  step: PluginRecipeStep<InstallPluginStepSettings>;
};

export function StepInstallPlugin({ step }: Props): ReactElement {
  return <div>Install Plugin</div>;
}
