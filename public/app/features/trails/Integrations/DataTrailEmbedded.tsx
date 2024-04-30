import { css } from '@emotion/css';
import React from 'react';

import { AdHocVariableFilter, GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, SceneTimeRangeLike } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { DataTrail } from '../DataTrail';

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
  }
}

function DataTrailEmbeddedRenderer({ model }: SceneComponentProps<DataTrailEmbedded>) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.drawerInnerWrapper}>
      <model.trail.Component model={model.trail} />
    </div>
  );
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

function getStyles(theme: GrafanaTheme2) {
  return {
    drawerInnerWrapper: css({
      display: 'flex',
      padding: theme.spacing(2),
      background: theme.isDark ? theme.colors.background.canvas : theme.colors.background.primary,
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
    }),
  };
}
