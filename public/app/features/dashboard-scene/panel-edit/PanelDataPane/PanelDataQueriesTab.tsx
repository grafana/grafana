import React from 'react';

import { IconName } from '@grafana/data';
import { SceneObjectBase, SceneComponentProps } from '@grafana/scenes';

import { PanelDataPaneTabState, PanelDataPaneTab } from './types';

export class PanelDataQueriesTab extends SceneObjectBase<PanelDataPaneTabState> implements PanelDataPaneTab {
  static Component = PanelDataQueriesTabRendered;
  tabId = 'queries';
  icon: IconName = 'database';

  getTabLabel() {
    return 'Queries';
  }
}

function PanelDataQueriesTabRendered(props: SceneComponentProps<PanelDataQueriesTab>) {
  return <div>TODO Queries</div>;
}
