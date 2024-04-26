import React from 'react';

import { SceneComponentProps, SceneObjectBase, VizPanel, sceneGraph } from '@grafana/scenes';
import { PanelHeaderNotices } from 'app/features/dashboard/dashgrid/PanelHeader/PanelHeaderNotices';

import { getPanelIdForVizPanel } from '../utils/utils';

export class PanelNotices extends SceneObjectBase {
  static Component = PanelNoticesRenderer;

  constructor() {
    super({});
    this.addActivationHandler(this.onActivate);
  }

  private onActivate = () => {
    const panel = this.parent;
    if (!panel || !(panel instanceof VizPanel)) {
      throw new Error('PanelNotices can be used only as title items for VizPanel');
    }
  };

  public getPanel() {
    const panel = this.parent;

    if (panel && panel instanceof VizPanel) {
      return panel;
    }

    return null;
  }
}

function PanelNoticesRenderer({ model }: SceneComponentProps<PanelNotices>) {
  const panel = model.getPanel();
  const dataObject = sceneGraph.getData(model);
  const data = dataObject.useState();

  if (!panel) {
    return null;
  }

  const panelId = getPanelIdForVizPanel(panel);

  if (data.data?.series) {
    return <PanelHeaderNotices frames={data.data?.series} panelId={panelId} />;
  }

  return null;
}
