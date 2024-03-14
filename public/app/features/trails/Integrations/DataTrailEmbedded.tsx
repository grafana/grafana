import React from 'react';

import { DataTrailEmbeddedState as DataTrailEmbeddedStateRuntime } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';

import { DataTrail } from '../DataTrail';

export type DataTrailEmbeddedState = DataTrailEmbeddedStateRuntime;

export class DataTrailEmbedded extends SceneObjectBase<DataTrailEmbeddedState> {
  static Component = DataTrailEmbeddedRenderer;

  public trail: DataTrail;

  constructor(state: DataTrailEmbeddedState) {
    super(state);
    this.trail = buildDataTrailFromState(state);
  }
}

function DataTrailEmbeddedRenderer({ model }: SceneComponentProps<DataTrailEmbedded>) {
  return <model.trail.Component model={model.trail} />;
}

export function buildDataTrailFromState({ metric, filters, dataSourceUid, timeRange }: DataTrailEmbeddedState) {
  return new DataTrail({
    $timeRange: timeRange,
    metric,
    initialDS: dataSourceUid,
    initialFilters: filters,
    embedded: true,
  });
}
