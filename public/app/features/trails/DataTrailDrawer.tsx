import React from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, SceneTimeRangeLike } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';
import { Drawer } from '@grafana/ui';
import { PromVisualQuery } from 'app/plugins/datasource/prometheus/querybuilder/types';

import { getDashboardSceneFor } from '../dashboard-scene/utils/utils';

import { DataTrail } from './DataTrail';
import { getDataTrailsApp } from './DataTrailsApp';
import { OpenEmbeddedTrailEvent } from './shared';

interface DataTrailDrawerState extends SceneObjectState {
  timeRange: SceneTimeRangeLike;
  query: PromVisualQuery;
  dsRef: DataSourceRef;
}

export class DataTrailDrawer extends SceneObjectBase<DataTrailDrawerState> {
  static Component = DataTrailDrawerRenderer;

  public trail: DataTrail;

  constructor(state: DataTrailDrawerState) {
    super(state);

    this.trail = buildDataTrailFromQuery(state);
    this.trail.addActivationHandler(() => {
      this.trail.subscribeToEvent(OpenEmbeddedTrailEvent, this.onOpenTrail);
    });
  }

  onOpenTrail = () => {
    getDataTrailsApp().goToUrlForTrail(this.trail.clone({ embedded: false }));
  };

  onClose = () => {
    const dashboard = getDashboardSceneFor(this);
    dashboard.closeModal();
  };
}

function DataTrailDrawerRenderer({ model }: SceneComponentProps<DataTrailDrawer>) {
  return (
    <Drawer title={'Data trail'} onClose={model.onClose} size="lg">
      <div style={{ display: 'flex', height: '100%' }}>
        <model.trail.Component model={model.trail} />
      </div>
    </Drawer>
  );
}

export function buildDataTrailFromQuery({ query, dsRef, timeRange }: DataTrailDrawerState) {
  const filters = query.labels.map((label) => ({ key: label.label, value: label.value, operator: label.op }));

  const ds = getDataSourceSrv().getInstanceSettings(dsRef);

  return new DataTrail({
    $timeRange: timeRange,
    metric: query.metric,
    initialDS: ds?.uid,
    initialFilters: filters,
    embedded: true,
  });
}
