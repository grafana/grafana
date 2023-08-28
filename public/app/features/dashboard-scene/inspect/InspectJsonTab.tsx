import React from 'react';

import { SceneComponentProps, SceneObjectBase, VizPanel } from '@grafana/scenes';
import { t } from 'app/core/internationalization';

import { InspectTab } from '../../inspector/types';

import { InspectTabState } from './types';

export class InspectJsonTab extends SceneObjectBase<InspectTabState> {
  constructor(public panel: VizPanel) {
    super({ label: t('dashboard.inspect.json-tab', 'JSON'), value: InspectTab.JSON });
  }

  static Component = ({ model }: SceneComponentProps<InspectJsonTab>) => {
    return <div>JSON</div>;
  };
}
