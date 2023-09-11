import React from 'react';

import { SceneComponentProps, sceneGraph, SceneObjectBase } from '@grafana/scenes';

import { InspectStatsTab as OldInspectStatsTab } from '../../inspector/InspectStatsTab';

import { InspectTabState } from './types';

export class InspectStatsTab extends SceneObjectBase<InspectTabState> {
  static Component = ({ model }: SceneComponentProps<InspectStatsTab>) => {
    const data = sceneGraph.getData(model.state.panelRef.resolve()).useState();
    const timeRange = sceneGraph.getTimeRange(model.state.panelRef.resolve());

    if (!data.data) {
      return null;
    }

    return <OldInspectStatsTab data={data.data} timeZone={timeRange.getTimeZone()} />;
  };
}
