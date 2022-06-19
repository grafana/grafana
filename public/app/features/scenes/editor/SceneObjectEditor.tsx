import React from 'react';
// import { useStyles2 } from '@grafana/ui';

import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';

import { SceneObject } from '../models/types';

export interface Props {
  model: SceneObject;
}

export function SceneObjectEditor({ model }: Props) {
  // const styles = useStyles2(getStyles);
  // const state = model.useState();

  return (
    <OptionsPaneCategory id="props" title="Properties" forceOpen={1}>
      <model.Editor model={model} key={model.state.key} />
    </OptionsPaneCategory>
  );
}
