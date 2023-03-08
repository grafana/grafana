import React from 'react';

import { SceneObject } from '@grafana/scenes';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';

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
