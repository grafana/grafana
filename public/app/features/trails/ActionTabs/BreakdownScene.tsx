import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  PanelBuilders,
  QueryVariable,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneDataNode,
  SceneFlexItem,
  SceneFlexItemLike,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { Button, Field, useStyles2 } from '@grafana/ui';
import { ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { getAutoQueriesForMetric } from '../AutomaticMetricQueries/AutoQueryEngine';
import { AutoQueryDef } from '../AutomaticMetricQueries/types';
import { BreakdownLabelSelector } from '../BreakdownLabelSelector';
import { MetricScene } from '../MetricScene';
import { trailDS, VAR_FILTERS, VAR_GROUP_BY, VAR_GROUP_BY_EXP } from '../shared';
import { getColorByIndex } from '../utils';

import { AddToFiltersGraphAction } from './AddToFiltersGraphAction';
import { ByFrameRepeater } from './ByFrameRepeater';
import { LayoutSwitcher } from './LayoutSwitcher';
import { getLabelOptions } from './utils';

export interface BreakdownSceneState extends SceneObjectState {
  body?: SceneObject;
  labels: Array<SelectableValue<string>>;
  value?: string;
  loading?: boolean;
}

export class BreakdownScene extends SceneObjectBase<BreakdownSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERS],
    onReferencedVariableValueChanged: this.onReferencedVariableValueChanged.bind(this),
  });

  constructor(state: Partial<BreakdownSceneState>) {
    super({
      labels: state.labels ?? [],
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _query?: AutoQueryDef;

  private _onActivate() {
    const variable = this.getVariable();

    variable.subscribeToState((newState, oldState) => {
      if (
        newState.options !== oldState.options ||
        newState.value !== oldState.value ||
        newState.loading !== oldState.loading
      ) {
        this.updateBody(variable);
      }
    });

    const metric = sceneGraph.getAncestor(this, MetricScene).state.metric;
    this._query = getAutoQueriesForMetric(metric).breakdown;

    this.updateBody(variable);
  }

  private getVariable(): QueryVariable {
    const variable = sceneGraph.lookupVariable(VAR_GROUP_BY, this)!;
    if (!(variable instanceof QueryVariable)) {
      throw new Error('Group by variable not found');
    }

    return variable;
  }

  private onReferencedVariableValueChanged() {
    const variable = this.getVariable();
    variable.changeValueTo(ALL_VARIABLE_VALUE);
    this.updateBody(variable);
  }

  private updateBody(variable: QueryVariable) {
    const options = getLabelOptions(this, variable);

    const stateUpdate: Partial<BreakdownSceneState> = {
      loading: variable.state.loading,
      value: String(variable.state.value),
      labels: options,
    };

    if (!variable.state.loading) {
      stateUpdate.body = variable.hasAllValue()
        ? buildAllLayout(options, this._query!)
        : buildNormalLayout(this._query!);
    }

    this.setState(stateUpdate);
  }

  public onChange = (value?: string) => {
    if (!value) {
      return;
    }

    const variable = this.getVariable();

    if (value === ALL_VARIABLE_VALUE) {
      this.setState({ body: buildAllLayout(this.state.labels, this._query!) });
    } else if (variable.hasAllValue()) {
      this.setState({ body: buildNormalLayout(this._query!) });
    }

    variable.changeValueTo(value);
  };

  public static Component = ({ model }: SceneComponentProps<BreakdownScene>) => {
    const { labels, body, loading, value } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        {loading && <div>Loading...</div>}
        <div className={styles.controls}>
          {!loading && (
            <div className={styles.controlsLeft}>
              <Field label="By label">
                <BreakdownLabelSelector options={labels} value={value} onChange={model.onChange} />
              </Field>
            </div>
          )}
          {body instanceof LayoutSwitcher && (
            <div className={styles.controlsRight}>
              <body.Selector model={body} />
            </div>
          )}
        </div>
        <div className={styles.content}>{body && <body.Component model={body} />}</div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      flexGrow: 1,
      display: 'flex',
      minHeight: '100%',
      flexDirection: 'column',
    }),
    content: css({
      flexGrow: 1,
      display: 'flex',
      paddingTop: theme.spacing(0),
    }),
    controls: css({
      flexGrow: 0,
      display: 'flex',
      alignItems: 'top',
      gap: theme.spacing(2),
    }),
    controlsRight: css({
      flexGrow: 0,
      display: 'flex',
      justifyContent: 'flex-end',
    }),
    controlsLeft: css({
      display: 'flex',
      justifyContent: 'flex-left',
      justifyItems: 'left',
      width: '100%',
      flexDirection: 'column',
    }),
  };
}

export function buildAllLayout(options: Array<SelectableValue<string>>, queryDef: AutoQueryDef) {
  const children: SceneFlexItemLike[] = [];

  for (const option of options) {
    if (option.value === ALL_VARIABLE_VALUE) {
      continue;
    }

    const expr = queryDef.queries[0].expr.replace(VAR_GROUP_BY_EXP, String(option.value));
    const unit = queryDef.unit;

    children.push(
      new SceneCSSGridItem({
        body: PanelBuilders.timeseries()
          .setTitle(option.label!)
          .setData(
            new SceneQueryRunner({
              maxDataPoints: 300,
              datasource: trailDS,
              queries: [
                {
                  refId: 'A',
                  expr: expr,
                  legendFormat: `{{${option.label}}}`,
                },
              ],
            })
          )
          .setHeaderActions(new SelectLabelAction({ labelName: String(option.value) }))
          .setUnit(unit)
          .build(),
      })
    );
  }

  return new LayoutSwitcher({
    options: [
      { value: 'grid', label: 'Grid' },
      { value: 'rows', label: 'Rows' },
    ],
    active: 'grid',
    layouts: [
      new SceneCSSGridLayout({
        templateColumns: GRID_TEMPLATE_COLUMNS,
        autoRows: '200px',
        children: children,
      }),
      new SceneCSSGridLayout({
        templateColumns: '1fr',
        autoRows: '200px',
        children: children,
      }),
    ],
  });
}

const GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';

function buildNormalLayout(queryDef: AutoQueryDef) {
  return new LayoutSwitcher({
    $data: new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: 300,
      queries: queryDef.queries,
    }),
    options: [
      { value: 'single', label: 'Single' },
      { value: 'grid', label: 'Grid' },
      { value: 'rows', label: 'Rows' },
    ],
    active: 'grid',
    layouts: [
      new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexItem({
            minHeight: 300,
            body: PanelBuilders.timeseries().setTitle('$metric').build(),
          }),
        ],
      }),
      new ByFrameRepeater({
        body: new SceneCSSGridLayout({
          templateColumns: GRID_TEMPLATE_COLUMNS,
          autoRows: '200px',
          children: [],
        }),
        getLayoutChild: (data, frame, frameIndex) => {
          return new SceneCSSGridItem({
            body: queryDef
              .vizBuilder()
              .setTitle(getLabelValue(frame))
              .setData(new SceneDataNode({ data: { ...data, series: [frame] } }))
              .setColor({ mode: 'fixed', fixedColor: getColorByIndex(frameIndex) })
              .setHeaderActions(new AddToFiltersGraphAction({ frame }))
              .build(),
          });
        },
      }),
      new ByFrameRepeater({
        body: new SceneCSSGridLayout({
          templateColumns: '1fr',
          autoRows: '200px',
          children: [],
        }),
        getLayoutChild: (data, frame, frameIndex) => {
          return new SceneCSSGridItem({
            body: queryDef
              .vizBuilder()
              .setTitle(getLabelValue(frame))
              .setData(new SceneDataNode({ data: { ...data, series: [frame] } }))
              .setColor({ mode: 'fixed', fixedColor: getColorByIndex(frameIndex) })
              .setHeaderActions(new AddToFiltersGraphAction({ frame }))
              .build(),
          });
        },
      }),
    ],
  });
}

function getLabelValue(frame: DataFrame) {
  const labels = frame.fields[1]?.labels;

  if (!labels) {
    return 'No labels';
  }

  const keys = Object.keys(labels);
  if (keys.length === 0) {
    return 'No labels';
  }

  return labels[keys[0]];
}

export function buildBreakdownActionScene() {
  return new SceneFlexItem({
    body: new BreakdownScene({}),
  });
}

interface SelectLabelActionState extends SceneObjectState {
  labelName: string;
}
export class SelectLabelAction extends SceneObjectBase<SelectLabelActionState> {
  public onClick = () => {
    getBreakdownSceneFor(this).onChange(this.state.labelName);
  };

  public static Component = ({ model }: SceneComponentProps<AddToFiltersGraphAction>) => {
    return (
      <Button variant="primary" size="sm" fill="text" onClick={model.onClick}>
        Select
      </Button>
    );
  };
}

function getBreakdownSceneFor(model: SceneObject): BreakdownScene {
  if (model instanceof BreakdownScene) {
    return model;
  }

  if (model.parent) {
    return getBreakdownSceneFor(model.parent);
  }

  throw new Error('Unable to find breakdown scene');
}
