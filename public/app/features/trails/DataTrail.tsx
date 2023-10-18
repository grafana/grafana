import { css } from '@emotion/css';
import React from 'react';

import { AdHocVariableFilter, GrafanaTheme2 } from '@grafana/data';
import {
  AdHocFiltersVariable,
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
import { MetricScene } from './MetricScene';
import { MetrricSelectScene } from './MetricSelectScene';
import { MetricSelectedEvent, trailsDS, VAR_FILTERS } from './shared';

export interface DataTrailState extends SceneObjectState {
  topScene: SceneObject;
  embedded?: boolean;
  filters?: AdHocVariableFilter[];
  mainScene?: SceneObject;
  controls: SceneObject[];
  history: DataTrailHistory;
  debug?: boolean;

  // Sycned with url
  metric?: string;
}

export class DataTrail extends SceneObjectBase<DataTrailState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['metric'] });
  private _selectMetricView: SceneObject;

  public constructor(state: Partial<DataTrailState>) {
    super({
      $timeRange: new SceneTimeRange({}),
      $variables: new SceneVariableSet({
        variables: [
          AdHocFiltersVariable.create({
            name: 'filters',
            datasource: trailsDS,
            filters: state.filters ?? [],
          }),
        ],
      }),
      controls: [
        new VariableValueSelectors({}),
        new SceneControlsSpacer(),
        new SceneTimePicker({}),
        new SceneRefreshPicker({}),
      ],
      history: new DataTrailHistory({}),
      topScene: new MetrricSelectScene({ showHeading: true }),
      ...state,
    });

    this._selectMetricView = this.state.topScene;
    this.syncSceneWithState();
    this.addActivationHandler(this._onActivate.bind(this));
  }

  public _onActivate() {
    if (!this.state.embedded) {
      getUrlSyncManager().initSync(this);
    }

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

    // if (!this.state.embedded) {
    //   getUrlSyncManager().initSync(this);
    // }
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
    this.setState({
      topScene: new MetricScene({ metric: evt.payload }),
      metric: evt.payload,
    });

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
        stateUpdate.topScene = new MetricScene({ metric: values.metric });
      }
    } else if (values.metric === null) {
      stateUpdate.metric = undefined;
      stateUpdate.topScene = this._selectMetricView;
    }

    this.setState(stateUpdate);
  }

  private syncSceneWithState() {
    let topScene = this.state.topScene;

    if (this.state.metric) {
      topScene = new MetricScene({ metric: this.state.metric });
    } else {
      topScene = this._selectMetricView;
    }

    if (topScene !== this.state.topScene) {
      this.setState({ topScene });
    }
  }

  public onToggleDebug = () => {
    this.setState({ debug: !this.state.debug });
  };

  static Component = ({ model }: SceneComponentProps<DataTrail>) => {
    const { controls, topScene, history, debug } = model.useState();
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
              icon="eye"
              onClick={model.onToggleDebug}
              variant={debug ? 'active' : 'canvas'}
              tooltip="Show more information"
            />
          </div>
        )}
        <div className={styles.body}>
          <topScene.Component model={topScene} />
        </div>
      </div>
    );
  };
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
      gap: theme.spacing(1),
      alignItems: 'center',
      flexWrap: 'wrap',
    }),
  };
}
