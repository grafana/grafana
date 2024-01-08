import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  AdHocFiltersVariable,
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
  SceneVariableSet,
} from '@grafana/scenes';
import { Button, Field, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { AddToFiltersGraphAction } from './AddToFiltersGraphAction';
import { getAutoQueriesForMetric } from './AutomaticMetricQueries/AutoQueryEngine';
import { AutoQueryDef } from './AutomaticMetricQueries/types';
import { ByFrameRepeater } from './ByFrameRepeater';
import { LayoutSwitcher } from './LayoutSwitcher';
import { MetricScene } from './MetricScene';
import { trailDS, VAR_FILTERS, VAR_GROUP_BY, VAR_GROUP_BY_EXP, VAR_METRIC_EXPR } from './shared';
import { getColorByIndex } from './utils';

export interface BreakdownSceneState extends SceneObjectState {
  body?: SceneObject;
  labels: Array<SelectableValue<string>>;
  value?: string;
  loading?: boolean;
}

/**
 * Just a proof of concept example of a behavior
 */
export class BreakdownScene extends SceneObjectBase<BreakdownSceneState> {
  constructor(state: Partial<BreakdownSceneState>) {
    super({
      $variables: state.$variables ?? getVariableSet(),
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

  private updateBody(variable: QueryVariable) {
    const options = this.getLabelOptions(variable);

    const stateUpdate: Partial<BreakdownSceneState> = {
      loading: variable.state.loading,
      value: String(variable.state.value),
      labels: options,
    };

    if (!this.state.body && !variable.state.loading) {
      stateUpdate.body = variable.hasAllValue()
        ? buildAllLayout(options, this._query!)
        : buildNormalLayout(this._query!);
    }

    this.setState(stateUpdate);
  }

  private getLabelOptions(variable: QueryVariable) {
    const labelFilters = sceneGraph.lookupVariable(VAR_FILTERS, this);
    const labelOptions: Array<SelectableValue<string>> = [];

    if (!(labelFilters instanceof AdHocFiltersVariable)) {
      return [];
    }

    const filters = labelFilters.state.set.state.filters;

    for (const option of variable.getOptionsForSelect()) {
      const filterExists = filters.find((f) => f.key === option.value);
      if (!filterExists) {
        labelOptions.push({ label: option.label, value: String(option.value) });
      }
    }

    return labelOptions;
  }

  public onChange = (value: string) => {
    const variable = this.getVariable();

    if (value === ALL_VARIABLE_VALUE) {
      this.setState({ body: buildAllLayout(this.getLabelOptions(variable), this._query!) });
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
          <Field label="By label">
            <RadioButtonGroup options={labels} value={value} onChange={model.onChange} />
          </Field>
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
    tabHeading: css({
      paddingRight: theme.spacing(2),
      fontWeight: theme.typography.fontWeightMedium,
    }),
    controls: css({
      flexGrow: 0,
      display: 'flex',
      alignItems: 'top',
      gap: theme.spacing(2),
    }),
    controlsRight: css({
      flexGrow: 1,
      display: 'flex',
      justifyContent: 'flex-end',
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

    children.push(
      new SceneCSSGridItem({
        body: PanelBuilders.timeseries()
          .setTitle(option.label!)
          .setUnit(queryDef.unit)
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

function getVariableSet() {
  return new SceneVariableSet({
    variables: [
      new QueryVariable({
        name: VAR_GROUP_BY,
        label: 'Group by',
        datasource: trailDS,
        includeAll: true,
        defaultToAll: true,
        query: { query: `label_names(${VAR_METRIC_EXPR})`, refId: 'A' },
        value: '',
        text: '',
      }),
    ],
  });
}

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
              .vizBuilder(queryDef)
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
              .vizBuilder(queryDef)
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
