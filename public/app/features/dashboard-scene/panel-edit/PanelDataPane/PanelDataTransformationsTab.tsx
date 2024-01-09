import React from 'react';

import { IconName } from '@grafana/data';
import { SceneObjectBase, SceneComponentProps } from '@grafana/scenes';

import { PanelDataPaneTabState, PanelDataPaneTab } from './types';

export class PanelDataTransformationsTab extends SceneObjectBase<PanelDataPaneTabState> implements PanelDataPaneTab {
  static Component = PanelDataTransformationsTabRendered;
  tabId = 'transformations';
  icon: IconName = 'process';

  getTabLabel() {
    return 'Transformations';
  }
}

function PanelDataTransformationsTabRendered(props: SceneComponentProps<PanelDataTransformationsTab>) {
  return <div>TODO Transformations</div>;
}
