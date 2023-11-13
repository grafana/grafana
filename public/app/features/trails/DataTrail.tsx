import { css } from '@emotion/css';
import React from 'react';

import { AdHocVariableFilter, GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  DataSourceVariable,
  getUrlSyncManager,
  SceneComponentProps,
  SceneControlsSpacer,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  VariableValueSelectors,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { DataTrailSettings } from './DataTrailSettings';
import { DataTrailHistory, DataTrailHistoryStep } from './DataTrailsHistory';
import { MetricScene } from './MetricScene';
import { MetricSelectScene } from './MetricSelectScene';
import { MetricSelectedEvent, trailDS, LOGS_METRIC, VAR_DATASOURCE } from './shared';
import { getUrlForTrail } from './utils';

export interface DataTrailState extends SceneObjectState {
  topScene?: SceneObject;
  embedded?: boolean;
  controls: SceneObject[];
  history: DataTrailHistory;
  settings: DataTrailSettings;

  // just for for the starting data source
  initialDS?: string;
  initialFilters?: AdHocVariableFilter[];

  // Synced with url
  metric?: string;
}

export class DataTrail extends SceneObjectBase<DataTrailState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['metric'] });

  public constructor(state: Partial<DataTrailState>) {
    super({
      $timeRange: state.$timeRange ?? new SceneTimeRange({}),
      $variables: state.$variables ?? getVariableSet(state.initialDS, state.metric, state.initialFilters),
      controls: state.controls ?? [
        new VariableValueSelectors({ layout: 'vertical' }),
        new SceneControlsSpacer(),
        new SceneTimePicker({}),
        new SceneRefreshPicker({}),
      ],
      history: state.history ?? new DataTrailHistory({}),
      settings: state.settings ?? new DataTrailSettings({}),
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  public _onActivate() {
    if (!this.state.topScene) {
      this.setState({ topScene: getTopSceneFor(this.state.metric) });
    }

    // Some scene elements publish this
    this.subscribeToEvent(MetricSelectedEvent, this._handleMetricSelectedEvent.bind(this));

    return () => {
      if (!this.state.embedded) {
        getUrlSyncManager().cleanUp(this);
      }
    };
  }

  public goBackToStep(step: DataTrailHistoryStep) {
    if (!this.state.embedded) {
      getUrlSyncManager().cleanUp(this);
    }

    if (!step.trailState.metric) {
      step.trailState.metric = undefined;
    }

    this.setState(step.trailState);

    if (!this.state.embedded) {
      locationService.replace(getUrlForTrail(this));

      getUrlSyncManager().initSync(this);
    }
  }

  private _handleMetricSelectedEvent(evt: MetricSelectedEvent) {
    if (this.state.embedded) {
      this.setState(this.getSceneUpdatesForNewMetricValue(evt.payload));
    } else {
      locationService.partial({ metric: evt.payload, actionView: null });
    }
  }

  private getSceneUpdatesForNewMetricValue(metric: string | undefined) {
    const stateUpdate: Partial<DataTrailState> = {};
    stateUpdate.metric = metric;
    stateUpdate.topScene = getTopSceneFor(metric);
    return stateUpdate;
  }

  getUrlState() {
    return { metric: this.state.metric };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<DataTrailState> = {};

    if (typeof values.metric === 'string') {
      if (this.state.metric !== values.metric) {
        Object.assign(stateUpdate, this.getSceneUpdatesForNewMetricValue(values.metric));
      }
    } else if (values.metric === null) {
      stateUpdate.metric = undefined;
      stateUpdate.topScene = new MetricSelectScene({ showHeading: true });
    }

    this.setState(stateUpdate);
  }

  static Component = ({ model }: SceneComponentProps<DataTrail>) => {
    const { controls, topScene, history, settings } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        <history.Component model={history} />
        {controls && (
          <div className={styles.controls}>
            {controls.map((control) => (
              <control.Component key={control.state.key} model={control} />
            ))}
            <settings.Component model={settings} />
          </div>
        )}
        <div className={styles.body}>{topScene && <topScene.Component model={topScene} />}</div>
      </div>
    );
  };
}

function getTopSceneFor(metric?: string) {
  if (metric) {
    return new MetricScene({ metric: metric });
  } else {
    return new MetricSelectScene({ showHeading: true });
  }
}

function getVariableSet(initialDS?: string, metric?: string, initialFilters?: AdHocVariableFilter[]) {
  return new SceneVariableSet({
    variables: [
      new DataSourceVariable({
        name: VAR_DATASOURCE,
        label: 'Data source',
        value: initialDS,
        pluginId: metric === LOGS_METRIC ? 'loki' : 'prometheus',
      }),
      AdHocFiltersVariable.create({
        name: 'filters',
        datasource: trailDS,
        layout: 'vertical',
        filters: initialFilters ?? [],
      }),
    ],
  });
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      flexGrow: 1,
      display: 'flex',
      gap: theme.spacing(2),
      minHeight: '100%',
      flexDirection: 'column',
    }),
    body: css({
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    controls: css({
      display: 'flex',
      gap: theme.spacing(2),
      alignItems: 'flex-end',
      flexWrap: 'wrap',
    }),
  };
}
