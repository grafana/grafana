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
  SceneObjectStateChangedEvent,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  SceneVariableValueChangedEvent,
  VariableValueSelectors,
} from '@grafana/scenes';
import { ToolbarButton, useStyles2 } from '@grafana/ui';

import { DataTrailHistory, DataTrailHistoryStep } from './DataTrailsHistory';
import { LogsScene, LogsSearch } from './LogsScene';
import { MetricScene } from './MetricScene';
import { MetricSelectScene } from './MetricSelectScene';
import { MetricSelectedEvent, metricDS, VAR_FILTERS, LOGS_METRIC, VAR_DATASOURCE } from './shared';
import { getUrlForTrail } from './utils';

export interface DataTrailState extends SceneObjectState {
  topScene?: SceneObject;
  embedded?: boolean;
  filters?: AdHocVariableFilter[];
  controls: SceneObject[];
  history: DataTrailHistory;
  advancedMode?: boolean;

  // just for for the starting data source
  initialDS?: string;

  // Synced with url
  metric?: string;
}

export class DataTrail extends SceneObjectBase<DataTrailState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['metric'] });

  public constructor(state: Partial<DataTrailState>) {
    super({
      $timeRange: state.$timeRange ?? new SceneTimeRange({}),
      $variables:
        state.$variables ??
        new SceneVariableSet({
          variables: [
            new DataSourceVariable({
              name: VAR_DATASOURCE,
              label: 'Data source',
              value: state.initialDS,
              pluginId: 'prometheus',
            }),
            AdHocFiltersVariable.create({
              name: 'filters',
              datasource: metricDS,
              layout: 'simple',
              filters: state.filters ?? [],
            }),
          ],
        }),
      controls: state.controls ?? [
        new VariableValueSelectors({ layout: 'vertical' }),
        new LogsSearch({}),
        new SceneControlsSpacer(),
        new SceneTimePicker({}),
        new SceneRefreshPicker({}),
      ],
      history: state.history ?? new DataTrailHistory({}),
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  public _onActivate() {
    if (!this.state.topScene) {
      this.setState({ topScene: getTopSceneFor(this.state) });
    }

    this.state.history.trailActivated(this);

    // Some scene elements publish this
    this.subscribeToEvent(MetricSelectedEvent, this._handleMetricSelectedEvent.bind(this));
    this.subscribeToEvent(SceneVariableValueChangedEvent, this._handleVariableValueChanged.bind(this));
    this.subscribeToEvent(SceneObjectStateChangedEvent, this._handleSceneObjectStateChanged.bind(this));

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

    this.setState(step.trailState);
    locationService.replace(getUrlForTrail(this));

    if (!this.state.embedded) {
      getUrlSyncManager().initSync(this);
    }
  }

  private _handleSceneObjectStateChanged(evt: SceneObjectStateChangedEvent) {
    if (evt.payload.changedObject instanceof SceneTimeRange) {
      this.state.history.addTrailStep(this, 'time');
    }
  }

  private _handleVariableValueChanged(evt: SceneVariableValueChangedEvent) {
    if (evt.payload.state.name === VAR_FILTERS) {
      this.state.history.addTrailStep(this, 'filters');
    }
  }

  private _handleMetricSelectedEvent(evt: MetricSelectedEvent) {
    if (this.state.embedded) {
      this.setState({
        topScene: new MetricScene({ metric: evt.payload }),
        metric: evt.payload,
      });
    } else {
      locationService.partial({ metric: evt.payload, actionView: null });
    }

    this.state.history.addTrailStep(this, 'metric');
  }

  getUrlState() {
    return { metric: this.state.metric };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<DataTrailState> = {};

    if (typeof values.metric === 'string') {
      if (this.state.metric !== values.metric) {
        stateUpdate.metric = values.metric;
        stateUpdate.topScene = getTopSceneFor(stateUpdate);
      }
    } else if (values.metric === null) {
      stateUpdate.metric = undefined;
      stateUpdate.topScene = new MetricSelectScene({ showHeading: true });
    }

    this.setState(stateUpdate);
  }

  public onToggleAdvanced = () => {
    this.setState({ advancedMode: !this.state.advancedMode });
  };

  static Component = ({ model }: SceneComponentProps<DataTrail>) => {
    const { controls, topScene, history, advancedMode } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        <history.Component model={history} />
        {controls && (
          <div className={styles.controls}>
            {controls.map((control) => (
              <control.Component key={control.state.key} model={control} />
            ))}
            <ToolbarButton
              icon="cog"
              onClick={model.onToggleAdvanced}
              variant={advancedMode ? 'active' : 'canvas'}
              tooltip="Advanced mode"
            />
          </div>
        )}
        <div className={styles.body}>{topScene && <topScene.Component model={topScene} />}</div>
      </div>
    );
  };
}

function getTopSceneFor(state: Partial<DataTrailState>) {
  if (state.metric) {
    if (state.metric === LOGS_METRIC) {
      return new LogsScene({});
    }
    return new MetricScene({ metric: state.metric });
  } else {
    return new MetricSelectScene({ showHeading: true });
  }
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
