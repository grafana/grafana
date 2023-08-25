import React from 'react';

import { SceneComponentProps, SceneObjectBase, VizPanel } from '@grafana/scenes';
import { t } from 'app/core/internationalization';

import { InspectTab } from '../../inspector/types';

import { InspectTabState } from './types';

export class InspectDataTab extends SceneObjectBase<InspectTabState> {
  constructor(public panel: VizPanel) {
    super({ label: t('dashboard.inspect.data-tab', 'Data'), value: InspectTab.Data });
  }

  static Component = ({ model }: SceneComponentProps<InspectDataTab>) => {
    //const data = sceneGraph.getData(model.panel).useState();

    return <div>Data tab</div>;
  };
}
