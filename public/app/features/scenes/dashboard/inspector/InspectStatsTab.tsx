import React from 'react';

import { SceneComponentProps, sceneGraph, SceneObjectBase, VizPanel } from '@grafana/scenes';
import { t } from 'app/core/internationalization';

import { InspectStatsTab as OldInspectStatsTab } from '../../../inspector/InspectStatsTab';
import { InspectTab } from '../../../inspector/types';

import { InspectTabState } from './types';

export class InspectStatsTab extends SceneObjectBase<InspectTabState> {
  constructor(public panel: VizPanel) {
    super({ label: t('dashboard.inspect.stats-tab', 'Stats'), value: InspectTab.Stats });
  }

  static Component = ({ model }: SceneComponentProps<InspectStatsTab>) => {
    const data = sceneGraph.getData(model.panel).useState();
    const timeRange = sceneGraph.getTimeRange(model.panel);

    if (!data.data) {
      return null;
    }

    return <OldInspectStatsTab data={data.data} timeZone={timeRange.getTimeZone()} />;
  };
}
