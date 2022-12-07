import React, { ReactElement } from 'react';

import { PluginRecipeInstallPluginStep } from '../types';

type Props = {
  step: PluginRecipeInstallPluginStep;
};

export function StepInstallPlugin({ step }: Props): ReactElement {
  return <div>Install Plugin</div>;
}
