import React from 'react';

import { locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Drawer } from '@grafana/ui';

interface ScenePanelInspectorState extends SceneObjectState {
  panelKey: string;
}

export class ScenePanelInspector extends SceneObjectBase<ScenePanelInspectorState> {
  static Component = ScenePanelInspectorRenderer;

  onClose = () => {
    locationService.partial({ inspect: null });
  };
}

function ScenePanelInspectorRenderer({ model }: SceneComponentProps<ScenePanelInspector>) {
  const { panel } = model.;

  if (!panel) {
    return null;
  }

  return (
    <Drawer
      title={`Inspect: ${panel.state.title}`}
      scrollableContent
      onClose={model.onClose}
      size="md"
    >
      Magic content
    </Drawer>
  );
}
