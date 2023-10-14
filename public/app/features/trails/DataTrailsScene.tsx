import React from 'react';

import { getFrameDisplayName } from '@grafana/data';
import {
  ConstantVariable,
  EmbeddedScene,
  getUrlSyncManager,
  PanelBuilders,
  QueryVariable,
  SceneComponentProps,
  SceneDataNode,
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

import { BreakdownActionButton } from './BreakdownAction';
import { ByFrameRepeater } from './ByFrameRepeater';
import { buildSelectMetricScene } from './StepSelectMetric';
import { SplittableLayoutItem, VariableTabLayout } from './VariableTabLayout';

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
        activeScene: buildGraphScene(this.getSelectMetricScene(), this.state.metric),
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
          activeScene: buildGraphScene(this.getSelectMetricScene(), values.metric),
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

function buildGraphScene(currentScene: EmbeddedScene, metric: string) {
  const clone = currentScene.clone();

  clone.setState({
    $variables: new SceneVariableSet({
      variables: [
        clone.state.$variables!.state.variables[0],
        new ConstantVariable({
          name: 'metric',
          value: metric,
        }),
      ],
    }),
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          minHeight: 400,
          body: PanelBuilders.timeseries()
            .setTitle(metric)
            .setData(
              new SceneQueryRunner({
                datasource: trailsDS,
                queries: [
                  {
                    refId: 'A',
                    expr: 'sum(rate(${metric}{${labelFilters}}[$__rate_interval]))',
                  },
                ],
              })
            )
            .setHeaderActions(
              new BreakdownActionButton({
                isEnabled: false,
                childIndex: 1,
                getBreakdownScene: getBreakdownScene,
              })
            )
            .build(),
        }),
      ],
    }),
  });

  return clone;
}

function getBreakdownScene() {
  return new SceneFlexItem({
    body: new VariableTabLayout({
      $variables: new SceneVariableSet({
        variables: [
          new QueryVariable({
            name: 'groupby',
            label: 'Group by',
            datasource: { uid: 'gdev-prometheus' },
            query: 'label_names(${metric})',
            value: '',
            text: '',
          }),
        ],
      }),
      variableName: 'groupby',
      $data: new SceneQueryRunner({
        queries: [
          {
            refId: 'A',
            datasource: { uid: 'gdev-prometheus' },
            expr: 'sum(rate(${metric}{${labelFilters}}[$__rate_interval])) by($groupby)',
          },
        ],
      }),
      body: new SplittableLayoutItem({
        isSplit: false,
        single: new SceneFlexLayout({
          direction: 'column',
          children: [
            new SceneFlexItem({
              minHeight: 300,
              body: PanelBuilders.timeseries().setHoverHeader(true).build(),
            }),
          ],
        }),
        split: new ByFrameRepeater({
          body: new SceneFlexLayout({
            direction: 'column',
            children: [],
          }),
          getLayoutChild: (data, frame, frameIndex) => {
            return new SceneFlexItem({
              minHeight: 200,
              body: PanelBuilders.timeseries()
                .setTitle(getFrameDisplayName(frame, frameIndex))
                .setData(new SceneDataNode({ data: { ...data, series: [frame] } }))
                .setOption('legend', { showLegend: false })
                .setCustomFieldConfig('fillOpacity', 9)
                .build(),
            });
          },
        }),
      }),
    }),
  });
}
