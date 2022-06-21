import React from 'react';

import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';

import { SceneObject } from '../core/types';

export interface Props {
  model: SceneObject;
}

export function SceneObjectEditor({ model }: Props) {
  return (
    <OptionsPaneCategory id="props" title="Properties" forceOpen={1}>
      <model.Editor model={model} key={model.state.key} />
    </OptionsPaneCategory>
  );
}
