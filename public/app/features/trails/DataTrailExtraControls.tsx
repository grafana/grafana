import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';

export class DataTrailsExtraControls extends SceneObjectBase {
  constructor() {
    super({});
  }

  static Component = ({ model }: SceneComponentProps<SceneObjectState>) => {
    return (
      <>
        <ToolbarButton variant={'canvas'} icon="compass" tooltip="Open in explore (todo)" disabled />
        <ToolbarButton variant={'canvas'}>Add to dashboard</ToolbarButton>
      </>
    );
  };
}
