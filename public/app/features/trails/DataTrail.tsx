import { css } from '@emotion/css';
import React from 'react';

import { AdHocVariableFilter, getFrameDisplayName, GrafanaTheme2, VariableHide } from '@grafana/data';
import {
  AdHocFiltersVariable,
  ConstantVariable,
  getUrlSyncManager,
  PanelBuilders,
  QueryVariable,
  SceneComponentProps,
  SceneControlsSpacer,
  SceneDataNode,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneQueryRunner,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  VariableValueSelectors,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { ByFrameRepeater } from './ByFrameRepeater';
import { MetricActionBar } from './DataTrailsScene';
import { SelectMetricTrailView } from './SelectMetricTrailView';
import { SplittableLayoutItem, VariableTabLayout } from './VariableTabLayout';
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
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['metric', 'actionView'] });
  private _selectMetricView: SceneObject;

  public constructor(state: Partial<DataTrailState>) {
    super({
      activeScene: new SelectMetricTrailView({}),
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
      ...state,
    });

    this._selectMetricView = this.state.activeScene;
    this.addActivationHandler(this._onActivate.bind(this));
  }

  public _onActivate() {
    this.syncSceneWithState();

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
        stateUpdate.activeScene = buildGraphScene(values.metric);
      }
    } else if (values.metric === null) {
      stateUpdate.metric = undefined;
      stateUpdate.activeScene = this._selectMetricView;
    }

    if (typeof values.actionView === 'string') {
      if (this.state.actionView !== values.actionView) {
        stateUpdate.actionView = values.actionView;
        stateUpdate.actionScene = buildBreakdownScene(stateUpdate.metric ?? this.state.metric!);
      }
    } else if (values.actionView === null) {
      stateUpdate.actionView = undefined;
      stateUpdate.activeScene = undefined;
    }

    this.setState(stateUpdate);
  }

  private syncSceneWithState() {
    let activeScene = this.state.activeScene;

    if (!this.state.metric) {
      this.setState({ activeScene: this._selectMetricView });
      return;
    }

    if (this.state.metric) {
      activeScene = buildGraphScene(this.state.metric);
    }

    if (this.state.actionView === 'breakdown') {
      activeScene = buildBreakdownScene(this.state.metric);
    }

    this.setState({ activeScene });
  }

  public onToggleBreakdown = () => {
    if (this.state.actionView === 'breakdown') {
      this.setState({ actionView: undefined, actionScene: undefined });
    } else {
      this.setState({ actionView: 'breakdown', actionScene: buildBreakdownScene(this.state.metric!) });
    }
  };

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

export function buildGraphScene(metric: string) {
  return new SceneFlexLayout({
    $variables: new SceneVariableSet({
      variables: [
        new ConstantVariable({
          name: 'metric',
          value: metric,
          hide: VariableHide.hideVariable,
        }),
      ],
    }),
    direction: 'column',
    children: [
      new SceneFlexItem({
        minHeight: 400,
        maxHeight: 400,
        body: PanelBuilders.timeseries()
          .setTitle(metric)
          .setData(
            new SceneQueryRunner({
              datasource: trailsDS,
              queries: [
                {
                  refId: 'A',
                  expr: 'sum(rate(${metric}{${filters}}[$__rate_interval]))',
                },
              ],
            })
          )
          .build(),
      }),
      new SceneFlexItem({
        ySizing: 'content',
        body: new MetricActionBar({}),
      }),
    ],
  });
}

function buildBreakdownScene(metric: string) {
  return new VariableTabLayout({
    $variables: new SceneVariableSet({
      variables: [
        new ConstantVariable({
          name: 'metric',
          value: metric,
          hide: VariableHide.hideVariable,
        }),
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
          expr: 'sum(rate(${metric}{${filters}}[$__rate_interval])) by($groupby)',
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
  });
}
