import { css } from '@emotion/css';
import { min, max, isNumber, throttle } from 'lodash';

import { DataFrame, FieldType, GrafanaTheme2, PanelData, SelectableValue } from '@grafana/data';
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
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneObjectWithUrlSync,
  SceneQueryRunner,
  VariableDependencyConfig,
  VizPanel,
} from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import { Button, Field, useStyles2 } from '@grafana/ui';
import { ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { getAutoQueriesForMetric } from '../AutomaticMetricQueries/AutoQueryEngine';
import { AutoQueryDef } from '../AutomaticMetricQueries/types';
import { BreakdownLabelSelector } from '../BreakdownLabelSelector';
import { MetricScene } from '../MetricScene';
import { StatusWrapper } from '../StatusWrapper';
import { reportExploreMetrics } from '../interactions';
import { TRAIL_BREAKDOWN_VIEW_KEY, trailDS, VAR_FILTERS, VAR_GROUP_BY, VAR_GROUP_BY_EXP } from '../shared';
import { getColorByIndex, getTrailFor } from '../utils';

import { AddToFiltersGraphAction } from './AddToFiltersGraphAction';
import { ByFrameRepeater } from './ByFrameRepeater';
import { LayoutSwitcher } from './LayoutSwitcher';
import { breakdownPanelOptions } from './panelConfigs';
import { isBreakdownLayoutType, BreakdownLayoutType } from './types';
import { getLabelOptions } from './utils';
import { BreakdownAxisChangeEvent, yAxisSyncBehavior } from './yAxisSyncBehavior';

const MAX_PANELS_IN_ALL_LABELS_BREAKDOWN = 60;

export interface BreakdownSceneState extends SceneObjectState {
  body?: SceneObject;
  labels: Array<SelectableValue<string>>;
  value?: string;
  loading?: boolean;
  error?: string;
  blockingMessage?: string;
  breakdownLayout: BreakdownLayoutType;
}

export class BreakdownScene extends SceneObjectBase<BreakdownSceneState> implements SceneObjectWithUrlSync {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['breakdownLayout'] });
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERS],
    onReferencedVariableValueChanged: this.onReferencedVariableValueChanged.bind(this),
  });

  constructor(state: Partial<BreakdownSceneState>) {
    const breakdownLayout = localStorage.getItem(TRAIL_BREAKDOWN_VIEW_KEY);
    super({
      labels: state.labels ?? [],
      ...state,
      breakdownLayout: isBreakdownLayoutType(breakdownLayout) ? breakdownLayout : 'grid',
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _query?: AutoQueryDef;

  getUrlState() {
    return { breakdownLayout: this.state.breakdownLayout };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    if (typeof values.breakdownLayout === 'string') {
      const newBreakdownLayout = values.breakdownLayout as BreakdownLayoutType;
      if (this.state.breakdownLayout !== newBreakdownLayout) {
        // Change in layout will set up a different set of panel objects that haven't received the current yaxis range
        this.clearBreakdownPanelAxisValues();
        this.setState({ breakdownLayout: newBreakdownLayout });
      }
    }
  }

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

    const metricScene = sceneGraph.getAncestor(this, MetricScene);
    const metric = metricScene.state.metric;
    this._query = getAutoQueriesForMetric(metric).breakdown;

    // The following state changes (and conditions) will each result in a call to `clearBreakdownPanelAxisValues`.
    // By clearing the axis, subsequent calls to `reportBreakdownPanelData` will adjust to an updated axis range.
    // These state changes coincide with the panels having their data updated, making a call to `reportBreakdownPanelData`.
    // If the axis was not cleared by `clearBreakdownPanelAxisValues` any calls to `reportBreakdownPanelData` which result
    // in the same axis will result in no updates to the panels.

    const trail = getTrailFor(this);
    trail.state.$timeRange?.subscribeToState(() => {
      // The change in time range will cause a refresh of panel values.
      this.clearBreakdownPanelAxisValues();
    });

    this.updateBody(variable);
  }

  private breakdownPanelMaxValue: number | undefined;
  private breakdownPanelMinValue: number | undefined;
  public reportBreakdownPanelData(data: PanelData | undefined) {
    if (!data) {
      return;
    }

    let newMin = this.breakdownPanelMinValue;
    let newMax = this.breakdownPanelMaxValue;

    data.series.forEach((dataFrame) => {
      dataFrame.fields.forEach((breakdownData) => {
        if (breakdownData.type !== FieldType.number) {
          return;
        }
        const values = breakdownData.values.filter(isNumber);

        const maxValue = max(values);
        const minValue = min(values);

        newMax = max([newMax, maxValue].filter(isNumber));
        newMin = min([newMin, minValue].filter(isNumber));
      });
    });

    if (newMax === undefined || newMin === undefined || !Number.isFinite(newMax + newMin)) {
      return;
    }

    if (this.breakdownPanelMaxValue === newMax && this.breakdownPanelMinValue === newMin) {
      return;
    }

    this.breakdownPanelMaxValue = newMax;
    this.breakdownPanelMinValue = newMin;

    this._triggerAxisChangedEvent();
  }

  private _triggerAxisChangedEvent = throttle(() => {
    const { breakdownPanelMinValue, breakdownPanelMaxValue } = this;
    if (breakdownPanelMinValue !== undefined && breakdownPanelMaxValue !== undefined) {
      this.publishEvent(new BreakdownAxisChangeEvent({ min: breakdownPanelMinValue, max: breakdownPanelMaxValue }));
    }
  }, 1000);

  private clearBreakdownPanelAxisValues() {
    this.breakdownPanelMaxValue = undefined;
    this.breakdownPanelMinValue = undefined;
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
      error: variable.state.error,
      blockingMessage: undefined,
    };

    console.log('I am triggered');
    console.log(variable);

    if (!variable.state.loading && variable.state.options.length) {
      stateUpdate.body = variable.hasAllValue()
        ? buildAllLayout(options, this._query!, this.state.breakdownLayout, this.onBreakdownLayoutChange)
        : buildNormalLayout(this._query!, this.state.breakdownLayout, this.onBreakdownLayoutChange);
      stateUpdate.breakdownLayout =
        variable.hasAllValue() && this.state.breakdownLayout === 'single' ? 'grid' : this.state.breakdownLayout;
    } else if (!variable.state.loading) {
      stateUpdate.body = undefined;
      stateUpdate.blockingMessage = 'Unable to retrieve label options for currently selected metric.';
    }

    this.clearBreakdownPanelAxisValues();
    // Setting the new panels will gradually end up calling reportBreakdownPanelData to update the new min & max
    this.setState(stateUpdate);
  }

  public onBreakdownLayoutChange = (breakdownLayout: BreakdownLayoutType) => {
    const variable = this.getVariable();
    const options = getLabelOptions(this, variable);
    const body = variable.hasAllValue()
      ? buildAllLayout(options, this._query!, breakdownLayout, this.onBreakdownLayoutChange)
      : buildNormalLayout(this._query!, breakdownLayout, this.onBreakdownLayoutChange);
    this.setState({ body, breakdownLayout });
  };

  public onChange = (value?: string) => {
    if (!value) {
      return;
    }

    reportExploreMetrics('label_selected', { label: value, cause: 'selector' });
    const variable = this.getVariable();

    variable.changeValueTo(value);
  };

  public static Component = ({ model }: SceneComponentProps<BreakdownScene>) => {
    const { labels, body, loading, value, blockingMessage } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        <StatusWrapper {...{ isLoading: loading, blockingMessage }}>
          <div className={styles.controls}>
            {!loading && labels.length && (
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
        </StatusWrapper>
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

export function buildAllLayout(
  options: Array<SelectableValue<string>>,
  queryDef: AutoQueryDef,
  breakdownLayout: BreakdownLayoutType,
  onBreakdownLayoutChange: (breakdownLayout: BreakdownLayoutType) => void
) {
  const children: SceneFlexItemLike[] = [];

  for (const option of options) {
    if (option.value === ALL_VARIABLE_VALUE) {
      continue;
    }

    if (children.length === MAX_PANELS_IN_ALL_LABELS_BREAKDOWN) {
      break;
    }

    const expr = queryDef.queries[0].expr.replaceAll(VAR_GROUP_BY_EXP, String(option.value));
    const unit = queryDef.unit;

    const vizPanel = PanelBuilders.timeseries()
      .setTitle(option.label!)
      .setData(
        new SceneQueryRunner({
          maxDataPoints: 250,
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
      .setBehaviors([fixLegendForUnspecifiedLabelValueBehavior])
      .build();

    vizPanel.addActivationHandler(() => {
      vizPanel.onOptionsChange(breakdownPanelOptions);
    });

    children.push(
      new SceneCSSGridItem({
        $behaviors: [yAxisSyncBehavior],
        body: vizPanel,
      })
    );
  }
  return new LayoutSwitcher({
    options: [
      { value: 'grid', label: 'Grid' },
      { value: 'rows', label: 'Rows' },
    ],
    breakdownLayout,
    onBreakdownLayoutChange,
    layouts: [
      new SceneCSSGridLayout({
        templateColumns: GRID_TEMPLATE_COLUMNS,
        autoRows: '200px',
        children: children,
        isLazy: true,
      }),
      new SceneCSSGridLayout({
        templateColumns: '1fr',
        autoRows: '200px',
        // Clone children since a scene object can only have one parent at a time
        children: children.map((c) => c.clone()),
        isLazy: true,
      }),
    ],
  });
}

const GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';

function buildNormalLayout(
  queryDef: AutoQueryDef,
  breakdownLayout: BreakdownLayoutType,
  onBreakdownLayoutChange: (breakdownLayout: BreakdownLayoutType) => void
) {
  const unit = queryDef.unit;

  function getLayoutChild(data: PanelData, frame: DataFrame, frameIndex: number): SceneFlexItem {
    const vizPanel: VizPanel = queryDef
      .vizBuilder()
      .setTitle(getLabelValue(frame))
      .setData(new SceneDataNode({ data: { ...data, series: [frame] } }))
      .setColor({ mode: 'fixed', fixedColor: getColorByIndex(frameIndex) })
      .setHeaderActions(new AddToFiltersGraphAction({ frame }))
      .setUnit(unit)
      .build();

    // Find a frame that has at more than one point.
    const isHidden = frame.length <= 1;

    const item: SceneCSSGridItem = new SceneCSSGridItem({
      $behaviors: [yAxisSyncBehavior],
      body: vizPanel,
      isHidden,
    });

    vizPanel.addActivationHandler(() => {
      vizPanel.onOptionsChange(breakdownPanelOptions);
    });

    return item;
  }

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
    breakdownLayout,
    onBreakdownLayoutChange,
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
        getLayoutChild,
      }),
      new ByFrameRepeater({
        body: new SceneCSSGridLayout({
          templateColumns: '1fr',
          autoRows: '200px',
          children: [],
        }),
        getLayoutChild,
      }),
    ],
  });
}

function getLabelValue(frame: DataFrame) {
  const labels = frame.fields[1]?.labels || {};

  const keys = Object.keys(labels);
  if (keys.length === 0) {
    return '<unspecified>';
  }

  return labels[keys[0]];
}

export function buildBreakdownActionScene() {
  return new BreakdownScene({});
}

interface SelectLabelActionState extends SceneObjectState {
  labelName: string;
}
export class SelectLabelAction extends SceneObjectBase<SelectLabelActionState> {
  public onClick = () => {
    const label = this.state.labelName;
    reportExploreMetrics('label_selected', { label, cause: 'breakdown_panel' });
    getBreakdownSceneFor(this).onChange(label);
  };

  public static Component = ({ model }: SceneComponentProps<AddToFiltersGraphAction>) => {
    return (
      <Button variant="secondary" size="sm" fill="solid" onClick={model.onClick}>
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

function fixLegendForUnspecifiedLabelValueBehavior(vizPanel: VizPanel) {
  vizPanel.state.$data?.subscribeToState((newState, prevState) => {
    const target = newState.data?.request?.targets[0];
    if (hasLegendFormat(target)) {
      const { legendFormat } = target;
      // Assume {{label}}
      const label = legendFormat.slice(2, -2);

      newState.data?.series.forEach((series) => {
        if (!series.fields[1].labels?.[label]) {
          const labels = series.fields[1].labels;
          if (labels) {
            labels[label] = `<unspecified ${label}>`;
          }
        }
      });
    }
  });
}

function hasLegendFormat(target: DataQuery | undefined): target is DataQuery & { legendFormat: string } {
  return target !== undefined && 'legendFormat' in target && typeof target.legendFormat === 'string';
}
