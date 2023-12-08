import React from 'react';

import { IconName } from '@grafana/data';
import { SceneObjectBase, SceneComponentProps, SceneObjectRef, SceneDataTransformer } from '@grafana/scenes';

import { PanelDataPaneTabState, PanelDataPaneTab } from './types';

interface PanelDataTransformationsTabState extends PanelDataPaneTabState {
  dataRef: SceneObjectRef<SceneDataTransformer>;
}

export class PanelDataTransformationsTab
  extends SceneObjectBase<PanelDataTransformationsTabState>
  implements PanelDataPaneTab
{
  static Component = PanelDataTransformationsTabRendered;
  tabId = 'transformations';
  icon: IconName = 'process';

  getTabLabel() {
    return 'Transformations';
  }
}

function PanelDataTransformationsTabRendered({ model }: SceneComponentProps<PanelDataTransformationsTab>) {
  // const { dataRef } = model.useState();
  // const dataObj = dataRef.resolve();
  // // const { transformations } = dataObj.useState();

  return <div>TODO Transformations</div>;
}
