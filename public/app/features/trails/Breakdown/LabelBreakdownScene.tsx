import init from '@bsull/augurs/outlier';
import { css } from '@emotion/css';
import { isNumber, max, min, throttle } from 'lodash';
import { useEffect, useState } from 'react';

import { DataFrame, FieldType, GrafanaTheme2, PanelData, SelectableValue } from '@grafana/data';
import { isValidLegacyName, utf8Support } from '@grafana/prometheus';
import { config } from '@grafana/runtime';
import {
  ConstantVariable,
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
  SceneReactObject,
  VariableDependencyConfig,
  VizPanel,
} from '@grafana/scenes';
import { DataQuery, SortOrder, TooltipDisplayMode } from '@grafana/schema';
import { Alert, Button, Field, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { BreakdownLabelSelector } from '../BreakdownLabelSelector';
import { DataTrail } from '../DataTrail';
import { PanelMenu } from '../Menu/PanelMenu';
import { MetricScene } from '../MetricScene';
import { StatusWrapper } from '../StatusWrapper';
import { getAutoQueriesForMetric } from '../autoQuery/getAutoQueriesForMetric';
import { AutoQueryDef } from '../autoQuery/types';
import { reportExploreMetrics } from '../interactions';
import { updateOtelJoinWithGroupLeft } from '../otel/util';
import { getSortByPreference } from '../services/store';
import { ALL_VARIABLE_VALUE } from '../services/variables';
import {
  MDP_METRIC_PREVIEW,
  RefreshMetricsEvent,
  trailDS,
  VAR_FILTERS,
  VAR_GROUP_BY,
  VAR_GROUP_BY_EXP,
  VAR_MISSING_OTEL_TARGETS,
  VAR_OTEL_GROUP_LEFT,
} from '../shared';
import { getColorByIndex, getTrailFor } from '../utils';

import { AddToFiltersGraphAction } from './AddToFiltersGraphAction';
import { BreakdownSearchReset, BreakdownSearchScene } from './BreakdownSearchScene';
import { ByFrameRepeater } from './ByFrameRepeater';
import { LayoutSwitcher } from './LayoutSwitcher';
import { SortByScene, SortCriteriaChanged } from './SortByScene';
import { BreakdownLayoutChangeCallback, BreakdownLayoutType } from './types';
import { getLabelOptions } from './utils';
import { BreakdownAxisChangeEvent, yAxisSyncBehavior } from './yAxisSyncBehavior';

const MAX_PANELS_IN_ALL_LABELS_BREAKDOWN = 60;

export interface LabelBreakdownSceneState extends SceneObjectState {
  body?: LayoutSwitcher;
  search: BreakdownSearchScene;
  sortBy: SortByScene;
  labels: Array<SelectableValue<string>>;
  value?: string;
  loading?: boolean;
  error?: string;
  blockingMessage?: string;
}

export class LabelBreakdownScene extends SceneObjectBase<LabelBreakdownSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERS],
    onReferencedVariableValueChanged: this.onReferencedVariableValueChanged.bind(this),
  });

  constructor(state: Partial<LabelBreakdownSceneState>) {
    super({
      ...state,
      labels: state.labels ?? [],
      sortBy: new SortByScene({ target: 'labels' }),
      search: new BreakdownSearchScene('labels'),
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _query?: AutoQueryDef;

  private _onActivate() {
    // eslint-disable-next-line no-console
    init().then(() => console.debug('Grafana ML initialized'));

    const variable = this.getVariable();

    if (config.featureToggles.enableScopesInMetricsExplore) {
      this._subs.add(
        this.subscribeToEvent(RefreshMetricsEvent, () => {
          this.updateBody(this.getVariable());
        })
      );
    }

    variable.subscribeToState((newState, oldState) => {
      if (
        newState.options !== oldState.options ||
        newState.value !== oldState.value ||
        newState.loading !== oldState.loading
      ) {
        this.updateBody(variable);
      }
    });

    this._subs.add(
      this.subscribeToEvent(BreakdownSearchReset, () => {
        this.state.search.clearValueFilter();
      })
    );
    this._subs.add(this.subscribeToEvent(SortCriteriaChanged, this.handleSortByChange));

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

    // OTEL
    this._subs.add(
      trail.subscribeToState(({ useOtelExperience }, oldState) => {
        // if otel changes
        if (useOtelExperience !== oldState.useOtelExperience) {
          this.updateBody(variable);
        }
      })
    );

    // OTEL
    const resourceAttributes = sceneGraph.lookupVariable(VAR_OTEL_GROUP_LEFT, trail);
    if (resourceAttributes instanceof ConstantVariable) {
      resourceAttributes?.subscribeToState((newState, oldState) => {
        // wait for the resource attributes to be loaded
        if (newState.value !== oldState.value) {
          this.updateBody(variable);
        }
      });
    }

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

  private handleSortByChange = (event: SortCriteriaChanged) => {
    if (event.target !== 'labels') {
      return;
    }
    if (this.state.body instanceof LayoutSwitcher) {
      this.state.body.state.breakdownLayouts.forEach((layout) => {
        if (layout instanceof ByFrameRepeater) {
          layout.sort(event.sortBy);
        }
      });
    }
    reportExploreMetrics('sorting_changed', { sortBy: event.sortBy });
  };

  private onReferencedVariableValueChanged() {
    const variable = this.getVariable();
    variable.changeValueTo(ALL_VARIABLE_VALUE);
    this.updateBody(variable);
  }

  private updateBody(variable: QueryVariable) {
    const options = getLabelOptions(this, variable);

    const trail = getTrailFor(this);

    let allLabelOptions = options;
    if (trail.state.useOtelExperience) {
      allLabelOptions = this.updateLabelOptions(trail, allLabelOptions);
    }

    const stateUpdate: Partial<LabelBreakdownSceneState> = {
      loading: variable.state.loading,
      value: String(variable.state.value),
      labels: allLabelOptions,
      error: variable.state.error,
      blockingMessage: undefined,
    };

    if (!variable.state.loading && variable.state.options.length) {
      stateUpdate.body = variable.hasAllValue()
        ? buildAllLayout(allLabelOptions, this._query!, this.onBreakdownLayoutChange, trail.state.useOtelExperience)
        : buildNormalLayout(this._query!, this.onBreakdownLayoutChange, this.state.search);
    } else if (!variable.state.loading) {
      stateUpdate.body = undefined;
      stateUpdate.blockingMessage = 'Unable to retrieve label options for currently selected metric.';
    }

    this.clearBreakdownPanelAxisValues();
    // Setting the new panels will gradually end up calling reportBreakdownPanelData to update the new min & max
    this.setState(stateUpdate);
  }

  public onBreakdownLayoutChange = (_: BreakdownLayoutType) => {
    this.clearBreakdownPanelAxisValues();
  };

  public onChange = (value?: string) => {
    if (!value) {
      return;
    }

    reportExploreMetrics('label_selected', { label: value, cause: 'selector' });
    const variable = this.getVariable();

    variable.changeValueTo(value);
  };

  private async updateOtelGroupLeft() {
    const trail = getTrailFor(this);

    if (trail.state.useOtelExperience) {
      await updateOtelJoinWithGroupLeft(trail, trail.state.metric ?? '');
    }
  }

  /**
   * supplement normal label options with resource attributes
   * @param trail
   * @param allLabelOptions
   * @returns
   */
  private updateLabelOptions(trail: DataTrail, allLabelOptions: SelectableValue[]): Array<SelectableValue<string>> {
    // when the group left variable is changed we should get all the resource attributes + labels
    const resourceAttributes = sceneGraph.lookupVariable(VAR_OTEL_GROUP_LEFT, trail)?.getValue();
    if (typeof resourceAttributes !== 'string') {
      return [];
    }

    const attributeArray: SelectableValue[] = resourceAttributes.split(',').map((el) => {
      let label = el;
      if (!isValidLegacyName(el)) {
        // remove '' from label
        label = el.slice(1, -1);
      }
      return { label, value: el };
    });
    // shift ALL value to the front
    const all: SelectableValue = [{ label: 'All', value: ALL_VARIABLE_VALUE }];
    const firstGroup = all.concat(attributeArray);

    // remove duplicates of ALL option
    allLabelOptions = allLabelOptions.filter((option) => option.value !== ALL_VARIABLE_VALUE);
    allLabelOptions = firstGroup.concat(allLabelOptions);

    return allLabelOptions;
  }

  public static Component = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
    const { labels, body, search, sortBy, loading, value, blockingMessage } = model.useState();
    const styles = useStyles2(getStyles);

    const trail = getTrailFor(model);
    const { useOtelExperience } = trail.useState();

    let allLabelOptions = labels;
    if (trail.state.useOtelExperience) {
      // All value moves to the middle because it is part of the label options variable
      const all: SelectableValue = [{ label: 'All', value: ALL_VARIABLE_VALUE }];
      allLabelOptions.filter((option) => option.value !== ALL_VARIABLE_VALUE).unshift(all);
    }

    const [dismissOtelWarning, updateDismissOtelWarning] = useState(false);
    const missingOtelTargets = sceneGraph.lookupVariable(VAR_MISSING_OTEL_TARGETS, trail)?.getValue();
    if (missingOtelTargets && !dismissOtelWarning) {
      reportExploreMetrics('missing_otel_labels_by_truncating_job_and_instance', {
        metric: trail.state.metric,
      });
    }

    useEffect(() => {
      if (useOtelExperience) {
        // this will update the group left variable
        model.updateOtelGroupLeft();
      }
    }, [model, useOtelExperience]);

    return (
      <div className={styles.container}>
        <StatusWrapper {...{ isLoading: loading, blockingMessage }}>
          <div className={styles.controls}>
            {!loading && labels.length && (
              <Field label={useOtelExperience ? 'By attribute' : 'By label'}>
                <BreakdownLabelSelector options={allLabelOptions} value={value} onChange={model.onChange} />
              </Field>
            )}

            {value !== ALL_VARIABLE_VALUE && (
              <>
                <Field label="Search" className={styles.searchField}>
                  <search.Component model={search} />
                </Field>
                <sortBy.Component model={sortBy} />
              </>
            )}
            {body instanceof LayoutSwitcher && (
              <Field label="View">
                <body.Selector model={body} />
              </Field>
            )}
          </div>
          {missingOtelTargets && !dismissOtelWarning && (
            <Alert
              title={`Warning: There may be missing Open Telemetry resource attributes.`}
              severity={'warning'}
              key={'warning'}
              onRemove={() => updateDismissOtelWarning(true)}
              className={styles.truncatedOTelResources}
            >
              <Trans i18nKey={'explore-metrics.breakdown.missing-otel-labels'}>
                This metric has too many job and instance label values to call the Prometheus label_values endpoint with
                the match[] parameter. These label values are used to join the metric with target_info, which contains
                the resource attributes. Please include more resource attributes filters.
              </Trans>
            </Alert>
          )}

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
      paddingTop: theme.spacing(1),
    }),
    content: css({
      flexGrow: 1,
      display: 'flex',
      paddingTop: theme.spacing(0),
    }),
    searchField: css({
      flexGrow: 1,
    }),
    controls: css({
      flexGrow: 0,
      display: 'flex',
      alignItems: 'flex-end',
      gap: theme.spacing(2),
      justifyContent: 'space-between',
    }),
    truncatedOTelResources: css({
      minWidth: '30vw',
      flexGrow: 0,
    }),
  };
}

export function buildAllLayout(
  options: Array<SelectableValue<string>>,
  queryDef: AutoQueryDef,
  onBreakdownLayoutChange: BreakdownLayoutChangeCallback,
  useOtelExperience?: boolean
) {
  const children: SceneFlexItemLike[] = [];

  for (const option of options) {
    if (option.value === ALL_VARIABLE_VALUE) {
      continue;
    }

    if (children.length === MAX_PANELS_IN_ALL_LABELS_BREAKDOWN) {
      break;
    }

    const expr = queryDef.queries[0].expr.replaceAll(VAR_GROUP_BY_EXP, utf8Support(String(option.value)));
    const unit = queryDef.unit;

    const vizPanel = PanelBuilders.timeseries()
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
      .setOption('legend', { showLegend: false })
      .setTitle(option.label!)
      .setData(
        new SceneQueryRunner({
          maxDataPoints: MDP_METRIC_PREVIEW,
          datasource: trailDS,
          queries: [
            {
              refId: `A-${option.label}`,
              expr,
              legendFormat: `{{${option.label}}}`,
              fromExploreMetrics: true,
            },
          ],
        })
      )
      .setHeaderActions([new SelectLabelAction({ labelName: String(option.value) })])
      .setShowMenuAlways(true)
      .setMenu(new PanelMenu({ labelName: String(option.value) }))
      .setUnit(unit)
      .setBehaviors([fixLegendForUnspecifiedLabelValueBehavior])
      .build();

    children.push(
      new SceneCSSGridItem({
        $behaviors: [yAxisSyncBehavior],
        body: vizPanel,
      })
    );
  }
  return new LayoutSwitcher({
    breakdownLayoutOptions: [
      { value: 'grid', label: 'Grid' },
      { value: 'rows', label: 'Rows' },
    ],
    onBreakdownLayoutChange,
    breakdownLayouts: [
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
  onBreakdownLayoutChange: BreakdownLayoutChangeCallback,
  searchScene: BreakdownSearchScene
) {
  const unit = queryDef.unit;

  function getLayoutChild(data: PanelData, frame: DataFrame, frameIndex: number): SceneFlexItem {
    const vizPanel: VizPanel = queryDef
      .vizBuilder()
      .setTitle(getLabelValue(frame))
      .setData(new SceneDataNode({ data: { ...data, series: [frame] } }))
      .setColor({ mode: 'fixed', fixedColor: getColorByIndex(frameIndex) })
      .setHeaderActions([new AddToFiltersGraphAction({ frame })])
      .setShowMenuAlways(true)
      .setMenu(new PanelMenu({ labelName: getLabelValue(frame) }))
      .setUnit(unit)
      .build();

    // Find a frame that has at more than one point.
    const isHidden = frame.length <= 1;

    const item: SceneCSSGridItem = new SceneCSSGridItem({
      $behaviors: [yAxisSyncBehavior],
      body: vizPanel,
      isHidden,
    });

    return item;
  }

  const { sortBy } = getSortByPreference('labels', 'outliers');
  const getFilter = () => searchScene.state.filter ?? '';

  return new LayoutSwitcher({
    $data: new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: MDP_METRIC_PREVIEW,
      queries: queryDef.queries,
    }),
    breakdownLayoutOptions: [
      { value: 'single', label: 'Single' },
      { value: 'grid', label: 'Grid' },
      { value: 'rows', label: 'Rows' },
    ],
    onBreakdownLayoutChange,
    breakdownLayouts: [
      new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexItem({
            minHeight: 300,
            body: PanelBuilders.timeseries()
              .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
              .setOption('legend', { showLegend: false })
              .setTitle('$metric')
              .build(),
          }),
        ],
      }),
      new ByFrameRepeater({
        body: new SceneCSSGridLayout({
          templateColumns: GRID_TEMPLATE_COLUMNS,
          autoRows: '200px',
          children: [
            new SceneFlexItem({
              body: new SceneReactObject({
                reactNode: <LoadingPlaceholder text="Loading..." />,
              }),
            }),
          ],
        }),
        getLayoutChild,
        sortBy,
        getFilter,
      }),
      new ByFrameRepeater({
        body: new SceneCSSGridLayout({
          templateColumns: '1fr',
          autoRows: '200px',
          children: [],
        }),
        getLayoutChild,
        sortBy,
        getFilter,
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

export function buildLabelBreakdownActionScene() {
  return new LabelBreakdownScene({});
}

interface SelectLabelActionState extends SceneObjectState {
  labelName: string;
}

export class SelectLabelAction extends SceneObjectBase<SelectLabelActionState> {
  public onClick = () => {
    const label = this.state.labelName;

    // check that it is resource or label and update the rudderstack event
    const trail = getTrailFor(this);
    const resourceAttributes = sceneGraph.lookupVariable(VAR_OTEL_GROUP_LEFT, trail)?.getValue();
    let otel_resource_attribute = false;
    if (typeof resourceAttributes === 'string') {
      otel_resource_attribute = resourceAttributes?.split(',').includes(label);
    }

    reportExploreMetrics('label_selected', { label, cause: 'breakdown_panel', otel_resource_attribute });
    getBreakdownSceneFor(this).onChange(label);
  };

  public static Component = ({ model }: SceneComponentProps<AddToFiltersGraphAction>) => {
    return (
      <Button variant="secondary" size="sm" fill="solid" onClick={model.onClick}>
        <Trans i18nKey="explore-metrics.breakdown.labelSelect">Select</Trans>
      </Button>
    );
  };
}

function getBreakdownSceneFor(model: SceneObject): LabelBreakdownScene {
  if (model instanceof LabelBreakdownScene) {
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
