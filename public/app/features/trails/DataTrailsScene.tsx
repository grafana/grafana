import React from 'react';

import {
  EmbeddedScene,
  getUrlSyncManager,
  PanelBuilders,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneQueryRunner,
  SceneVariableSet,
} from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { buildSelectMetricScene } from './StepSelectMetric';

export interface DataTrailState extends SceneObjectState {
  activeScene?: EmbeddedScene;
  metric?: string;
}

export class DataTrail extends SceneObjectBase<DataTrailState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['metric'] });

  public constructor(state: Partial<DataTrailState>) {
    super(state);

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _selectMetricScene?: EmbeddedScene;
  private getSelectMetricScene(): EmbeddedScene {
    if (this._selectMetricScene) {
      return this._selectMetricScene;
    }

    this._selectMetricScene = buildSelectMetricScene();
    return this._selectMetricScene;
  }

  public _onActivate() {
    if (!this.state.metric) {
      this.setState({ activeScene: this.getSelectMetricScene() });
    } else {
      this.setState({
        activeScene: buildInitialMetricScene(this.getSelectMetricScene(), this.state.metric),
      });
    }

    getUrlSyncManager().initSync(this);

    return () => {
      getUrlSyncManager().cleanUp(this);
    };
  }

  getUrlState() {
    return { metric: this.state.metric };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    console.log('updateFromUrl', values);

    if (typeof values.metric === 'string') {
      if (this.state.metric !== values.metric) {
        this.setState({
          metric: values.metric,
          activeScene: buildInitialMetricScene(this.getSelectMetricScene(), values.metric),
        });
      }
    } else if (this.state.metric) {
      this.setState({
        metric: undefined,
        activeScene: this.getSelectMetricScene(),
      });
    }
  }

  static Component = ({ model }: SceneComponentProps<DataTrail>) => {
    const { activeScene } = model.useState();

    if (!activeScene) {
      return null;
    }

    return <activeScene.Component model={activeScene} />;
  };
}

export interface DataTrailsAppState extends SceneObjectState {
  trail?: DataTrail;
}

export class DataTrailsApp extends SceneObjectBase<DataTrailsAppState> {
  public constructor(state: Partial<DataTrailsAppState>) {
    super(state);
  }

  static Component = ({ model }: SceneComponentProps<DataTrailsApp>) => {
    const { trail } = model.useState();

    if (!trail) {
      return null;
    }

    return (
      <Page navId="explore" pageNav={{ text: 'Data trails' }}>
        {trail && <trail.Component model={trail} />}
      </Page>
    );
  };
}

export const trailsDS = { uid: 'gdev-prometheus', type: 'prometheus' };

export const dataTrailsApp = new DataTrailsApp({
  trail: new DataTrail({}),
});

function buildInitialMetricScene(currentScene: EmbeddedScene, metric: string) {
  const clone = currentScene.clone();

  clone.setState({
    $variables: new SceneVariableSet({
      variables: [clone.state.$variables!.state.variables[0]],
    }),
    body: new SceneFlexLayout({
      children: [
        new SceneFlexItem({
          body: PanelBuilders.timeseries()
            .setTitle(metric)
            .setData(
              new SceneQueryRunner({
                datasource: trailsDS,
                queries: [
                  {
                    refId: 'A',
                    expr: `sum(rate(${metric}{\${labelFilters}}[$__rate_interval]))`,
                  },
                ],
              })
            )
            .build(),
        }),
      ],
    }),
  });

  return clone;
}
