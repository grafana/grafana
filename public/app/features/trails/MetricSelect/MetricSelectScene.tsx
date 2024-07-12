import { css } from '@emotion/css';
import { debounce, isEqual } from 'lodash';
import { useReducer } from 'react';

import { GrafanaTheme2, RawTimeRange, SelectableValue } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  NestedScene,
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneObjectStateChangedEvent,
  SceneTimeRange,
  SceneVariable,
  SceneVariableSet,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { Alert, Field, Icon, InlineSwitch, Input, RadioButtonGroup, Tooltip, useStyles2 } from '@grafana/ui';
import { Select } from '@grafana/ui/';

import { DataTrail } from '../DataTrail';
import { MetricScene } from '../MetricScene';
import { StatusWrapper } from '../StatusWrapper';
import { Node, Parser } from '../groop/parser';
import { getMetricDescription } from '../helpers/MetricDatasourceHelper';
import { reportExploreMetrics } from '../interactions';
import {
  getVariablesWithMetricConstant,
  MetricSelectedEvent,
  VAR_DATASOURCE,
  VAR_DATASOURCE_EXPR,
  VAR_FILTERS,
} from '../shared';
import { getFilters, getTrailFor, isSceneTimeRangeState } from '../utils';

import { SelectMetricAction } from './SelectMetricAction';
import { getMetricNames } from './api';
import { getPreviewPanelFor } from './previewPanel';
import { sortRelatedMetrics } from './relatedMetrics';
import { createJSRegExpFromSearchTerms, createPromRegExp, deriveSearchTermsFromInput } from './util';

type DisplayAs = (typeof metricSelectSceneDisplayOptions)[number]['value'];

interface MetricPanel {
  name: string;
  index: number;
  itemRef?: SceneObjectRef<SceneCSSGridItem>;
  isEmpty?: boolean;
  isPanel?: boolean;
  loaded?: boolean;
}

export interface MetricSelectSceneState extends SceneObjectState {
  body: SceneFlexLayout | SceneCSSGridLayout;
  rootGroup?: Node;
  selectedTabGroupOption?: string;
  showPreviews?: boolean;
  displayAs?: DisplayAs;
  metricNames?: string[];
  metricNamesLoading?: boolean;
  metricNamesError?: string;
  metricNamesWarning?: string;
}

const metricSelectSceneDisplayOptions = [
  {
    label: 'Default',
    value: 'all-metrics',
  },
  {
    label: 'Nested Rows',
    value: 'nested-rows',
  },
  {
    label: 'Tab View',
    value: 'tabs',
  },
  {
    label: 'Prefix Filter',
    value: 'prefix-filter',
  },
] as const;

const ROW_PREVIEW_HEIGHT = '175px';
const ROW_CARD_HEIGHT = '64px';

const MAX_METRIC_NAMES = 20000;

function generateBodyFormation(displayAs: DisplayAs = 'all-metrics'): {
  layout: SceneCSSGridLayout | SceneFlexLayout;
  displayAs: DisplayAs;
} {
  switch (displayAs) {
    case 'nested-rows':
      return {
        displayAs,
        layout: new SceneFlexLayout({
          direction: 'column',
          children: [],
        }),
      };
    case 'all-metrics':
    default:
      return {
        displayAs,
        layout: new SceneCSSGridLayout({
          children: [],
          templateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
          autoRows: ROW_PREVIEW_HEIGHT,
          isLazy: true,
        }),
      };
  }
}

export class MetricSelectScene extends SceneObjectBase<MetricSelectSceneState> {
  private previewCache: Record<string, MetricPanel> = {};
  private ignoreNextUpdate = false;
  private nestedSceneRec: Record<string, NestedScene> = {};
  private _debounceRefreshMetricNames = debounce(() => this._refreshMetricNames(), 1000);

  constructor(state: Partial<MetricSelectSceneState>) {
    const bodyFormation = generateBodyFormation(state.displayAs);
    super({
      showPreviews: true,
      $variables: state.$variables,
      displayAs: bodyFormation.displayAs,
      body: state.body ?? bodyFormation.layout,
      selectedTabGroupOption: 'all',
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE, VAR_FILTERS],
    onReferencedVariableValueChanged: (variable: SceneVariable) => {
      // In all cases, we want to reload the metric names
      this._debounceRefreshMetricNames();
    },
  });

  private _onActivate() {
    if (this.state.body.state.children.length === 0) {
      this.buildLayout();
    } else {
      // Temp hack when going back to select metric scene and variable updates
      this.ignoreNextUpdate = true;
    }

    const trail = getTrailFor(this);

    this._subs.add(
      trail.subscribeToEvent(MetricSelectedEvent, (event) => {
        const { steps, currentStep } = trail.state.history.state;
        const prevStep = steps[currentStep].parentIndex;
        const previousMetric = steps[prevStep].trailState.metric;
        const isRelatedMetricSelector = previousMetric !== undefined;

        if (event.payload !== undefined) {
          const metricSearch = getMetricSearch(trail);
          const searchTermCount = deriveSearchTermsFromInput(metricSearch).length;

          reportExploreMetrics('metric_selected', {
            from: isRelatedMetricSelector ? 'related_metrics' : 'metric_list',
            searchTermCount,
          });
        }
      })
    );

    this._subs.add(
      trail.subscribeToEvent(SceneObjectStateChangedEvent, (evt) => {
        if (evt.payload.changedObject instanceof SceneTimeRange) {
          const { prevState, newState } = evt.payload;

          if (isSceneTimeRangeState(prevState) && isSceneTimeRangeState(newState)) {
            if (prevState.from === newState.from && prevState.to === newState.to) {
              return;
            }
          }
        }
      })
    );

    this._subs.add(
      trail.subscribeToState(({ metricSearch }, oldState) => {
        const oldSearchTerms = deriveSearchTermsFromInput(oldState.metricSearch);
        const newSearchTerms = deriveSearchTermsFromInput(metricSearch);
        if (!isEqual(oldSearchTerms, newSearchTerms)) {
          this._debounceRefreshMetricNames();
        }
      })
    );

    this.subscribeToState((newState, prevState) => {
      if (newState.metricNames !== prevState.metricNames) {
        this.onMetricNamesChanged();
      }
    });

    this._debounceRefreshMetricNames();
  }

  private async _refreshMetricNames() {
    const trail = getTrailFor(this);
    const timeRange: RawTimeRange | undefined = trail.state.$timeRange?.state;

    if (!timeRange) {
      return;
    }

    const matchTerms = [];

    const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, this);
    const hasFilters = filtersVar instanceof AdHocFiltersVariable && filtersVar.getValue()?.valueOf();
    if (hasFilters) {
      matchTerms.push(sceneGraph.interpolate(trail, '${filters}'));
    }

    const metricSearchRegex = createPromRegExp(trail.state.metricSearch);
    if (metricSearchRegex) {
      matchTerms.push(`__name__=~"${metricSearchRegex}"`);
    }

    const match = `{${matchTerms.join(',')}}`;
    const datasourceUid = sceneGraph.interpolate(trail, VAR_DATASOURCE_EXPR);
    this.setState({ metricNamesLoading: true, metricNamesError: undefined, metricNamesWarning: undefined });

    try {
      const response = await getMetricNames(datasourceUid, timeRange, match, MAX_METRIC_NAMES);
      const searchRegex = createJSRegExpFromSearchTerms(getMetricSearch(this));
      const metricNames = searchRegex
        ? response.data.filter((metric) => !searchRegex || searchRegex.test(metric))
        : response.data;

      const metricNamesWarning = response.limitReached
        ? `This feature will only return up to ${MAX_METRIC_NAMES} metric names for performance reasons. ` +
          `This limit is being exceeded for the current data source. ` +
          `Add search terms or label filters to narrow down the number of metric names returned.`
        : undefined;

      let bodyLayout = this.state.body;
      const rootGroupNode = this.generateGroups(metricNames);

      if (this.state.displayAs === 'nested-rows') {
        const nestedScenes = this.generateNestedScene(rootGroupNode);
        bodyLayout = new SceneFlexLayout({ children: nestedScenes });
      }

      this.setState({
        metricNames,
        rootGroup: rootGroupNode,
        body: bodyLayout,
        metricNamesLoading: false,
        metricNamesWarning,
        metricNamesError: response.error,
      });
    } catch (err: unknown) {
      let error = 'Unknown error';
      if (isFetchError(err)) {
        if (err.cancelled) {
          error = 'Request cancelled';
        } else if (err.statusText) {
          error = err.statusText;
        }
      }

      this.setState({ metricNames: undefined, metricNamesLoading: false, metricNamesError: error });
    }
  }

  private generateGroups(metricNames: string[] = []) {
    const groopParser = new Parser();
    groopParser.config = {
      ...groopParser.config,
      maxDepth: 2,
      minGroupSize: 2,
      miscGroupKey: 'misc',
    };
    const { root: rootGroupNode } = groopParser.parse(metricNames);
    return rootGroupNode;
  }

  private generateNestedScene(rootGroupNode: Node): NestedScene[] {
    const nestedScenes: NestedScene[] = [];
    rootGroupNode.groups.forEach((value, key) => {
      // Check if we have a scene for that key already
      // If we don't have, let's create one
      if (!this.nestedSceneRec[key]) {
        this.nestedSceneRec[key] = new NestedScene({
          title: key,
          canCollapse: true,
          isCollapsed: true,
          body: new SceneCSSGridLayout({
            children: [],
            templateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
            autoRows: ROW_PREVIEW_HEIGHT,
            isLazy: true,
          }),
        });
      }
      nestedScenes.push(this.nestedSceneRec[key]);
    });
    return nestedScenes;
  }

  private sortedPreviewMetrics() {
    return Object.values(this.previewCache).sort((a, b) => {
      if (a.isEmpty && b.isEmpty) {
        return a.index - b.index;
      }
      if (a.isEmpty) {
        return 1;
      }
      if (b.isEmpty) {
        return -1;
      }
      return a.index - b.index;
    });
  }

  private onMetricNamesChanged() {
    const metricNames = this.state.metricNames || [];

    const nameSet = new Set(metricNames);

    Object.values(this.previewCache).forEach((panel) => {
      if (!nameSet.has(panel.name)) {
        panel.isEmpty = true;
      }
    });

    const trail = getTrailFor(this);
    const sortedMetricNames =
      trail.state.metric !== undefined ? sortRelatedMetrics(metricNames, trail.state.metric) : metricNames;
    const metricsMap: Record<string, MetricPanel> = {};
    const metricsLimit = 120;

    // Clear absent metrics from cache
    Object.keys(this.previewCache).forEach((metric) => {
      if (!nameSet.has(metric)) {
        delete this.previewCache[metric];
      }
    });

    for (let index = 0; index < sortedMetricNames.length; index++) {
      const metricName = sortedMetricNames[index];

      if (this.state.displayAs === 'all-metrics' && Object.keys(metricsMap).length > metricsLimit) {
        break;
      }

      const oldPanel = this.previewCache[metricName];

      const panel = oldPanel || { name: metricName, index, loaded: false };

      metricsMap[metricName] = panel;
    }

    try {
      // If there is a current metric, do not present it
      const currentMetric = sceneGraph.getAncestor(this, MetricScene).state.metric;
      delete metricsMap[currentMetric];
    } catch (err) {
      // There is no current metric
    }

    this.previewCache = metricsMap;
    this.buildLayout();
  }

  private async buildLayout() {
    // Temp hack when going back to select metric scene and variable updates
    if (this.ignoreNextUpdate) {
      this.ignoreNextUpdate = false;
      return;
    }
    const trail = getTrailFor(this);
    let children: SceneFlexItem[] = [];

    switch (this.state.displayAs) {
      case 'all-metrics':
        children = await this.populateAllMetricsLayout(trail);
        const rowTemplate = this.state.showPreviews ? ROW_PREVIEW_HEIGHT : ROW_CARD_HEIGHT;
        this.state.body.setState({ children, autoRows: rowTemplate });
        break;
      case 'nested-rows':
        await this.populateNestedRowsLayout(trail);
        break;
      case 'tabs':
      case 'prefix-filter':
        await this.populateFilterableViewLayout(trail);
        break;
      default:
        console.error('Not implemented yet: ', this.state.displayAs);
    }
  }

  private async populateAllMetricsLayout(trail: DataTrail) {
    const children: SceneFlexItem[] = [];
    const metricsList = this.sortedPreviewMetrics();

    // Get the current filters to determine the count of them
    // Which is required for `getPreviewPanelFor`
    const filters = getFilters(this);
    const currentFilterCount = filters?.length || 0;

    for (let index = 0; index < metricsList.length; index++) {
      const metric = metricsList[index];
      const metadata = await trail.getMetricMetadata(metric.name);
      const description = getMetricDescription(metadata);

      if (this.state.showPreviews) {
        if (metric.itemRef && metric.isPanel) {
          children.push(metric.itemRef.resolve());
          continue;
        }
        const panel = getPreviewPanelFor(metric.name, index, currentFilterCount, description);

        metric.itemRef = panel.getRef();
        metric.isPanel = true;
        children.push(panel);
      } else {
        const panel = new SceneCSSGridItem({
          $variables: new SceneVariableSet({
            variables: getVariablesWithMetricConstant(metric.name),
          }),
          body: getCardPanelFor(metric.name, description),
        });
        metric.itemRef = panel.getRef();
        metric.isPanel = false;
        children.push(panel);
      }
    }

    return children;
  }

  private async populateNestedRowsLayout(trail: DataTrail) {
    // Get the current filters to determine the count of them
    // Which is required for `getPreviewPanelFor`
    const filters = getFilters(this);

    let rootGroupNode = this.state.rootGroup;
    if (!rootGroupNode) {
      rootGroupNode = this.generateGroups(this.state.metricNames);
      this.setState({ rootGroup: rootGroupNode });
    }
    const nestedScenes = this.generateNestedScene(rootGroupNode);
    this.state.body.setState({ children: nestedScenes });

    for (const [groupKey, groupNode] of rootGroupNode.groups) {
      const children: SceneFlexItem[] = [];

      for (const [_, value] of groupNode.groups) {
        const panels = await this.populatePanels(trail, filters, value.values);
        children.push(...panels);
      }

      const morePanelsMaybe = await this.populatePanels(trail, filters, groupNode.values);
      children.push(...morePanelsMaybe);
      this.nestedSceneRec[groupKey].state.body.setState({ children });
    }
  }

  private async populateFilterableViewLayout(trail: DataTrail) {
    // Get the current filters to determine the count of them
    // Which is required for `getPreviewPanelFor`
    const filters = getFilters(this);

    let rootGroupNode = this.state.rootGroup;
    if (!rootGroupNode) {
      rootGroupNode = this.generateGroups(this.state.metricNames);
      this.setState({ rootGroup: rootGroupNode });
    }

    const children: SceneFlexItem[] = [];

    for (const [groupKey, groupNode] of rootGroupNode.groups) {
      if (this.state.selectedTabGroupOption !== 'all' && this.state.selectedTabGroupOption !== groupKey) {
        continue;
      }

      for (const [_, value] of groupNode.groups) {
        const panels = await this.populatePanels(trail, filters, value.values);
        children.push(...panels);
      }

      const morePanelsMaybe = await this.populatePanels(trail, filters, groupNode.values);
      children.push(...morePanelsMaybe);
    }

    this.state.body.setState({ children });
  }

  private async populatePanels(trail: DataTrail, filters: ReturnType<typeof getFilters>, values: string[]) {
    const currentFilterCount = filters?.length || 0;

    const kinder: SceneFlexItem[] = [];
    for (let index = 0; index < values.length; index++) {
      const metricName = values[index];
      const metric: MetricPanel = { name: metricName, index, loaded: false };
      const metadata = await trail.getMetricMetadata(metricName);
      const description = getMetricDescription(metadata);

      if (this.state.showPreviews) {
        if (metric.itemRef && metric.isPanel) {
          kinder.push(metric.itemRef.resolve());
          continue;
        }
        const panel = getPreviewPanelFor(metric.name, index, currentFilterCount, description);

        metric.itemRef = panel.getRef();
        metric.isPanel = true;
        kinder.push(panel);
      } else {
        const panel = new SceneCSSGridItem({
          $variables: new SceneVariableSet({
            variables: getVariablesWithMetricConstant(metric.name),
          }),
          body: getCardPanelFor(metric.name, description),
        });
        metric.itemRef = panel.getRef();
        metric.isPanel = false;
        kinder.push(panel);
      }
    }

    return kinder;
  }

  public updateMetricPanel = (metric: string, isLoaded?: boolean, isEmpty?: boolean) => {
    const metricPanel = this.previewCache[metric];
    if (metricPanel) {
      metricPanel.isEmpty = isEmpty;
      metricPanel.loaded = isLoaded;
      this.previewCache[metric] = metricPanel;
      if (this.state.displayAs === 'all-metrics') {
        this.buildLayout();
      }
    }
  };

  public onSearchQueryChange = (evt: React.SyntheticEvent<HTMLInputElement>) => {
    const metricSearch = evt.currentTarget.value;
    const trail = getTrailFor(this);
    // Update the variable
    trail.setState({ metricSearch });
  };

  public onMetricRadioChange = (val: string) => {
    this.setState({ selectedTabGroupOption: val });
    this.buildLayout();
  };

  public onPrefixFilterChange = (val: SelectableValue) => {
    this.setState({ selectedTabGroupOption: val.value });
    this.buildLayout();
  };

  public onDisplayTypeChanged = (val: SelectableValue) => {
    const bodyFormation = generateBodyFormation(val.value);
    if (val.value !== this.state.displayAs && (val.value === 'nested-rows' || this.state.displayAs === 'nested-rows')) {
      this.setState({ body: bodyFormation.layout, displayAs: val.value });
    } else {
      this.setState({ displayAs: val.value });
    }
    this.buildLayout();
  };

  public onTogglePreviews = () => {
    this.setState({ showPreviews: !this.state.showPreviews });
    this.buildLayout();
  };

  public static Component = ({ model }: SceneComponentProps<MetricSelectScene>) => {
    const {
      showPreviews,
      body,
      metricNames,
      metricNamesError,
      metricNamesLoading,
      metricNamesWarning,
      displayAs,
      rootGroup,
      selectedTabGroupOption,
    } = model.useState();
    const { children } = body.useState();
    const trail = getTrailFor(model);
    const styles = useStyles2(getStyles);

    const [warningDismissed, dismissWarning] = useReducer(() => true, false);

    const { metricSearch } = trail.useState();

    const tooStrict = children.length === 0 && metricSearch;
    const noMetrics = !metricNamesLoading && metricNames && metricNames.length === 0;

    const isLoading = metricNamesLoading && children.length === 0;

    const blockingMessage = isLoading
      ? undefined
      : (noMetrics && 'There are no results found. Try a different time range or a different data source.') ||
        (tooStrict && 'There are no results found. Try adjusting your search or filters.') ||
        undefined;

    const metricNamesWarningIcon = metricNamesWarning ? (
      <Tooltip
        content={
          <>
            <h4>Unable to retrieve metric names</h4>
            <p>{metricNamesWarning}</p>
          </>
        }
      >
        <Icon className={styles.warningIcon} name="exclamation-triangle" />
      </Tooltip>
    ) : undefined;

    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Field label={'Select Display'} className={styles.displayOption}>
            <Select
              width={20}
              value={displayAs}
              onChange={model.onDisplayTypeChanged}
              options={metricSelectSceneDisplayOptions.map((o) => ({ label: o.label, value: o.value }))}
            />
          </Field>
          {displayAs === 'prefix-filter' && (
            <Field label={'Select Prefix'} className={styles.displayOption}>
              <Select
                onChange={model.onPrefixFilterChange}
                value={selectedTabGroupOption}
                options={[
                  {
                    label: 'All',
                    value: 'all',
                  },
                  ...Array.from(rootGroup?.groups.keys() ?? []).map((g) => ({ label: `${g}_`, value: g })),
                ]}
              />
            </Field>
          )}
          <Field label={'Search metrics'} className={styles.searchField}>
            <Input
              placeholder="Search metrics"
              prefix={<Icon name={'search'} />}
              value={metricSearch}
              onChange={model.onSearchQueryChange}
              suffix={metricNamesWarningIcon}
            />
          </Field>
          <InlineSwitch showLabel={true} label="Show previews" value={showPreviews} onChange={model.onTogglePreviews} />
        </div>
        {metricNamesError && (
          <Alert title="Unable to retrieve metric names" severity="error">
            <div>We are unable to connect to your data source. Double check your data source URL and credentials.</div>
            <div>({metricNamesError})</div>
          </Alert>
        )}
        {metricNamesWarning && !warningDismissed && (
          <Alert
            title="Unable to retrieve all metric names"
            severity="warning"
            onSubmit={dismissWarning}
            onRemove={dismissWarning}
          >
            <div>{metricNamesWarning}</div>
          </Alert>
        )}
        <StatusWrapper {...{ isLoading, blockingMessage }}>
          {displayAs === 'tabs' && (
            <RadioButtonGroup
              className={styles.metricTabGroup}
              options={[
                {
                  label: 'All',
                  value: 'all',
                },
                ...Array.from(rootGroup?.groups.keys() ?? []).map((g) => ({ label: g, value: g })),
              ]}
              value={selectedTabGroupOption}
              onChange={model.onMetricRadioChange}
            />
          )}
          {/*// FIXME remove ts-ignore*/}
          {/*// @ts-ignore*/}
          <body.Component model={body} />
        </StatusWrapper>
      </div>
    );
  };
}

function getCardPanelFor(metric: string, description?: string) {
  return PanelBuilders.text()
    .setTitle(metric)
    .setDescription(description)
    .setHeaderActions(new SelectMetricAction({ metric, title: 'Select' }))
    .setOption('content', '')
    .build();
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    headingWrapper: css({
      marginBottom: theme.spacing(0.5),
    }),
    header: css({
      flexGrow: 0,
      display: 'flex',
      gap: theme.spacing(2),
      marginBottom: theme.spacing(2),
      alignItems: 'flex-end',
    }),
    searchField: css({
      flexGrow: 1,
      marginBottom: 0,
    }),
    metricTabGroup: css({
      marginBottom: theme.spacing(2),
    }),
    displayOption: css({
      flexGrow: 0,
      marginBottom: 0,
    }),
    warningIcon: css({
      color: theme.colors.warning.main,
    }),
  };
}

function getMetricSearch(scene: SceneObject) {
  const trail = getTrailFor(scene);
  return trail.state.metricSearch || '';
}
