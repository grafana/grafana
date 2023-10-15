import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';
import { Drawer } from '@grafana/ui';
import { PromVisualQuery } from 'app/plugins/datasource/prometheus/querybuilder/types';

import { getDashboardSceneFor } from '../dashboard-scene/utils/utils';

import { DataTrail } from './DataTrailsScene';

interface DataTrailDrawerState extends SceneObjectState {
  query: PromVisualQuery;
  dsRef: DataSourceRef;
  trail?: DataTrail;
}

export class DataTrailDrawer extends SceneObjectBase<DataTrailDrawerState> {
  static Component = DataTrailDrawerRenderer;

  constructor(state: DataTrailDrawerState) {
    super(state);

    this.addActivationHandler(this._activationHandler.bind(this));
  }

  private _activationHandler() {
    this.setState({ trail: buildDataTrailFromQuery(this.state.query) });
  }

  onClose = () => {
    const dashboard = getDashboardSceneFor(this);
    dashboard.closeModal();
  };
}

function DataTrailDrawerRenderer({ model }: SceneComponentProps<DataTrailDrawer>) {
  const { trail } = model.useState();

  if (!trail) {
    return;
  }

  return (
    <Drawer title={'Data trail'} onClose={model.onClose} size="lg">
      <trail.Component model={trail} />
    </Drawer>
  );
}

export function buildDataTrailFromQuery(query: PromVisualQuery) {
  const filters = query.labels.map((label) => ({ key: label.label, value: label.value, operator: label.op }));

  return new DataTrail({
    metric: query.metric,
    filters,
  });
}
