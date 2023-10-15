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
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  VariableValueSelectors,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { GraphTrailView } from './GraphTrailView';
import { SelectMetricTrailView } from './SelectMetricTrailView';
import { trailsDS } from './common';

export interface DataTrailState extends SceneObjectState {
  activeScene: SceneObject;
  urlSync?: boolean;
  filters?: AdHocVariableFilter[];
  mainScene?: SceneObject;
  actionScene?: SceneObject;
  controls: SceneObject[];

  // Sycned with url
  actionView?: string;
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
      activeScene: new SelectMetricTrailView({}),
      ...state,
    });

    this._selectMetricView = this.state.activeScene;
    this.syncSceneWithState();
    this.addActivationHandler(this._onActivate.bind(this));
  }

  public _onActivate() {
    if (this.state.urlSync) {
      getUrlSyncManager().initSync(this);
    }

    return () => {
      if (this.state.urlSync) {
        getUrlSyncManager().cleanUp(this);
      }
    };
  }

  getUrlState() {
    return { metric: this.state.metric, actionView: this.state.actionView };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<DataTrailState> = {};

    if (typeof values.metric === 'string') {
      if (this.state.metric !== values.metric) {
        stateUpdate.metric = values.metric;
        stateUpdate.activeScene = new GraphTrailView({ metric: values.metric });
      }
    } else if (values.metric === null) {
      stateUpdate.metric = undefined;
      stateUpdate.activeScene = this._selectMetricView;
    }

    this.setState(stateUpdate);
  }

  private syncSceneWithState() {
    let activeScene = this.state.activeScene;

    if (this.state.metric) {
      activeScene = new GraphTrailView({ metric: this.state.metric });
    } else {
      activeScene = this._selectMetricView;
    }

    if (activeScene !== this.state.activeScene) {
      this.setState({ activeScene });
    }
  }

  static Component = ({ model }: SceneComponentProps<DataTrail>) => {
    const { controls, activeScene, actionScene } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        {controls && (
          <div className={styles.controls}>
            {controls.map((control) => (
              <control.Component key={control.state.key} model={control} />
            ))}
          </div>
        )}
        <div className={styles.body}>
          <activeScene.Component model={activeScene} />
          {actionScene && <actionScene.Component model={actionScene} />}
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

      '> div:first-child': {
        flexGrow: 0,
      },
    }),
    controls: css({
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'center',
      flexWrap: 'wrap',
    }),
  };
}
