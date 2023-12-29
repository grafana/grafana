import React from 'react';

import { IconName } from '@grafana/data';
import { SceneObjectBase, SceneComponentProps } from '@grafana/scenes';

import { VizPanelManager } from '../VizPanelManager';

import { PanelDataPaneTabState, PanelDataPaneTab } from './types';

interface PanelDataTransformationsTabState extends PanelDataPaneTabState {}

export class PanelDataTransformationsTab
  extends SceneObjectBase<PanelDataTransformationsTabState>
  implements PanelDataPaneTab
{
  static Component = PanelDataTransformationsTabRendered;
  tabId = 'transformations';
  icon: IconName = 'process';
  private _panelManager: VizPanelManager;

  getTabLabel() {
    return 'Transformations';
  }

  getItemsCount() {
    return 0;
  }

  constructor(panelManager: VizPanelManager) {
    super({});

    this._panelManager = panelManager;
  }

  get panelManager() {
    return this._panelManager;
  }
}

function PanelDataTransformationsTabRendered({ model }: SceneComponentProps<PanelDataTransformationsTab>) {
  // const { dataRef } = model.useState();
  // const dataObj = dataRef.resolve();
  // // const { transformations } = dataObj.useState();

  return <div>TODO Transformations</div>;
}
