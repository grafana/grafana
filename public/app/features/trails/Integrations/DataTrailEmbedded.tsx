import React from 'react';

import { AdHocVariableFilter } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, SceneTimeRangeLike } from '@grafana/scenes';

import { DataTrail } from '../DataTrail';
import { getDataTrailsApp } from '../DataTrailsApp';
import { OpenEmbeddedTrailEvent } from '../shared';

export interface DataTrailEmbeddedState extends SceneObjectState {
  timeRange: SceneTimeRangeLike;
  metric?: string;
  filters?: AdHocVariableFilter[];
  dataSourceUid?: string;
}
export class DataTrailEmbedded extends SceneObjectBase<DataTrailEmbeddedState> {
  static Component = DataTrailEmbeddedRenderer;

  public trail: DataTrail;

  constructor(state: DataTrailEmbeddedState) {
    super(state);

    this.trail = buildDataTrailFromState(state);
    this.trail.addActivationHandler(() => {
      this.trail.subscribeToEvent(OpenEmbeddedTrailEvent, this.onOpenTrail);
    });
  }

  onOpenTrail = () => {
    getDataTrailsApp().goToUrlForTrail(this.trail.clone({ embedded: false }));
  };
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
