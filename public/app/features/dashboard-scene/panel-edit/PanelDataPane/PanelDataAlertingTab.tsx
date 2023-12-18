import React from 'react';

import { IconName } from '@grafana/data';
import { SceneObjectBase, SceneComponentProps } from '@grafana/scenes';

import { VizPanelManager } from '../VizPanelManager';

import { PanelDataPaneTabState, PanelDataPaneTab } from './types';

export class PanelDataAlertingTab extends SceneObjectBase<PanelDataPaneTabState> implements PanelDataPaneTab {
  static Component = PanelDataAlertingTabRendered;
  tabId = 'alert';
  icon: IconName = 'bell';
  private _panelManager: VizPanelManager;

  constructor(panelManager: VizPanelManager) {
    super({});

    this._panelManager = panelManager;
  }
  getTabLabel() {
    return 'Alert';
  }

  getItemsCount() {
    return 0;
  }

  get panelManager() {
    return this._panelManager;
  }
}

function PanelDataAlertingTabRendered(props: SceneComponentProps<PanelDataAlertingTab>) {
  return <div>TODO Alerting</div>;
}
