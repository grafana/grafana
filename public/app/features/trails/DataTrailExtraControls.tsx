import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';

import { OpenEmbeddedTrailEvent } from './shared';
import { getTrailFor } from './utils';

export class DataTrailsExtraControls extends SceneObjectBase<SceneObjectState> {
  constructor() {
    super({});
  }

  public onOpenTrail = () => {
    this.publishEvent(new OpenEmbeddedTrailEvent(), true);
  };

  public static Component = ({ model }: SceneComponentProps<DataTrailsExtraControls>) => {
    const trail = getTrailFor(model);

    return (
      <>
        <ToolbarButton variant={'canvas'} icon="compass" tooltip="Open in explore (todo)" disabled />
        <ToolbarButton variant={'canvas'}>Add to dashboard</ToolbarButton>
        {trail.state.embedded && (
          <ToolbarButton variant={'canvas'} onClick={model.onOpenTrail}>
            Open
          </ToolbarButton>
        )}
      </>
    );
  };
}
