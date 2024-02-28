import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React, { useCallback } from 'react';

import { GrafanaTheme2, VariableRefresh } from '@grafana/data';
import {
  PanelBuilders,
  QueryVariable,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneFlexItem,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneVariable,
  SceneVariableSet,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { Input, InlineSwitch, Field, Alert, Icon, useStyles2 } from '@grafana/ui';

import { getPreviewPanelFor } from './AutomaticMetricQueries/previewPanel';
import { MetricCategoryCascader } from './MetricCategory/MetricCategoryCascader';
import { MetricScene } from './MetricScene';
import { SelectMetricAction } from './SelectMetricAction';
import { StatusWrapper } from './StatusWrapper';
import { sortRelatedMetrics } from './relatedMetrics';
import { getVariablesWithMetricConstant, trailDS, VAR_DATASOURCE, VAR_FILTERS_EXPR, VAR_METRIC_NAMES } from './shared';
import { getFilters, getTrailFor } from './utils';

interface MetricPanel {
  name: string;
  index: number;
  itemRef?: SceneObjectRef<SceneCSSGridItem>;
  isEmpty?: boolean;
  isPanel?: boolean;
  loaded?: boolean;
}

export interface MetricSelectSceneState extends SceneObjectState {
  body: SceneCSSGridLayout;
  searchQuery?: string;
  showPreviews?: boolean;
  prefixFilter?: string;
  metricsAfterSearch?: string[];
  metricsAfterFilter?: string[];
}

const ROW_PREVIEW_HEIGHT = '175px';
const ROW_CARD_HEIGHT = '64px';

export class MetricSelectScene extends SceneObjectBase<MetricSelectSceneState> {
  private previewCache: Record<string, MetricPanel> = {};
  private ignoreNextUpdate = false;

  constructor(state: Partial<MetricSelectSceneState>) {
    super({
      $variables: state.$variables ?? getMetricNamesVariableSet(),
      body:
        state.body ??
        new SceneCSSGridLayout({
          children: [],
          templateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
          autoRows: ROW_PREVIEW_HEIGHT,
          isLazy: true,
        }),
      showPreviews: true,
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_METRIC_NAMES, VAR_DATASOURCE],
    onReferencedVariableValueChanged: (variable: SceneVariable) => {
      const { name } = variable.state;

      if (name === VAR_DATASOURCE) {
        // Clear all panels for the previous data source
        this.state.body.setState({ children: [] });
      } else if (name === VAR_METRIC_NAMES) {
        this.onMetricNamesChange();
        // Entire pipeline must be performed
        this.updateMetrics();
        this.buildLayout();
      }
    },
  });

  private _onActivate() {
    if (this.state.body.state.children.length === 0) {
      this.buildLayout();
    } else {
      // Temp hack when going back to select metric scene and variable updates
      this.ignoreNextUpdate = true;
    }
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

  private currentMetricNames = new Set<string>();

  private onMetricNamesChange() {
    // Get the datasource metrics list from the VAR_METRIC_NAMES variable
    const variable = sceneGraph.lookupVariable(VAR_METRIC_NAMES, this);

    if (!(variable instanceof QueryVariable)) {
      return;
    }

    if (variable.state.loading) {
      return;
    }

    const nameList = variable.state.options.map((option) => option.value.toString());
    const nameSet = new Set(nameList);

    Object.values(this.previewCache).forEach((panel) => {
      if (!nameSet.has(panel.name)) {
        panel.isEmpty = true;
      }
    });

    this.currentMetricNames = nameSet;
    this.buildLayout();
  }

  private applyMetricSearch() {
    // This should only occur when the `searchQuery` changes, of if the `metricNames` change
    const metricNames = Array.from(this.currentMetricNames);
    if (metricNames == null) {
      return;
    }
    const searchRegex = createSearchRegExp(this.state.searchQuery);

    if (!searchRegex) {
      this.setState({ metricsAfterSearch: metricNames });
    } else {
      const metricsAfterSearch = metricNames.filter((metric) => !searchRegex || searchRegex.test(metric));
      this.setState({ metricsAfterSearch });
    }
  }

  private applyMetricPrefixFilter() {
    // This should occur after an `applyMetricSearch`, or if the prefix filter has changed
    const { metricsAfterSearch, prefixFilter } = this.state;

    if (!prefixFilter || !metricsAfterSearch) {
      this.setState({ metricsAfterFilter: metricsAfterSearch });
    } else {
      const metricsAfterFilter = metricsAfterSearch.filter((metric) => metric.startsWith(prefixFilter));
      this.setState({ metricsAfterFilter });
    }
  }

  private updateMetrics(applySearchAndFilter = true) {
    if (applySearchAndFilter) {
      // Set to false if these are not required (because they can be assumed to have been suitably called).
      this.applyMetricSearch();
      this.applyMetricPrefixFilter();
    }

    const { metricsAfterFilter } = this.state;

    if (!metricsAfterFilter) {
      return;
    }

    const metricNames = metricsAfterFilter;
    const trail = getTrailFor(this);
    const sortedMetricNames =
      trail.state.metric !== undefined ? sortRelatedMetrics(metricNames, trail.state.metric) : metricNames;
    const metricsMap: Record<string, MetricPanel> = {};
    const metricsLimit = 120;

    // Clear absent metrics from cache
    Object.keys(this.previewCache).forEach((metric) => {
      if (!this.currentMetricNames.has(metric)) {
        delete this.previewCache[metric];
      }
    });

    for (let index = 0; index < sortedMetricNames.length; index++) {
      const metricName = sortedMetricNames[index];

      if (Object.keys(metricsMap).length > metricsLimit) {
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
  }

  private buildLayout() {
    // Temp hack when going back to select metric scene and variable updates
    if (this.ignoreNextUpdate) {
      this.ignoreNextUpdate = false;
      return;
    }

    const variable = sceneGraph.lookupVariable(VAR_METRIC_NAMES, this);

    if (!(variable instanceof QueryVariable)) {
      return;
    }

    if (variable.state.loading) {
      return;
    }

    if (!Object.keys(this.previewCache).length) {
      this.updateMetrics();
    }

    const children: SceneFlexItem[] = [];

    const metricsList = this.sortedPreviewMetrics();

    // Get the current filters to determine the count of them
    // Which is required for `getPreviewPanelFor`
    const filters = getFilters(this);
    const currentFilterCount = filters?.length || 0;

    for (let index = 0; index < metricsList.length; index++) {
      const metric = metricsList[index];

      if (this.state.showPreviews) {
        if (metric.itemRef && metric.isPanel) {
          children.push(metric.itemRef.resolve());
          continue;
        }
        const panel = getPreviewPanelFor(metric.name, index, currentFilterCount);
        metric.itemRef = panel.getRef();
        metric.isPanel = true;
        children.push(panel);
      } else {
        const panel = new SceneCSSGridItem({
          $variables: new SceneVariableSet({
            variables: getVariablesWithMetricConstant(metric.name),
          }),
          body: getCardPanelFor(metric.name),
        });
        metric.itemRef = panel.getRef();
        metric.isPanel = false;
        children.push(panel);
      }
    }

    const rowTemplate = this.state.showPreviews ? ROW_PREVIEW_HEIGHT : ROW_CARD_HEIGHT;

    this.state.body.setState({ children, autoRows: rowTemplate });
  }

  public updateMetricPanel = (metric: string, isLoaded?: boolean, isEmpty?: boolean) => {
    const metricPanel = this.previewCache[metric];
    if (metricPanel) {
      metricPanel.isEmpty = isEmpty;
      metricPanel.loaded = isLoaded;
      this.previewCache[metric] = metricPanel;
      this.buildLayout();
    }
  };

  public onSearchQueryChange = (evt: React.SyntheticEvent<HTMLInputElement>) => {
    this.setState({ searchQuery: evt.currentTarget.value });
    this.searchQueryChangedDebounced();
  };

  private searchQueryChangedDebounced = debounce(() => {
    this.updateMetrics(); // Need to repeat entire pipeline
    this.buildLayout();
  }, 500);

  public onPrefixFilterChange = (prefixFilter: string | undefined) => {
    this.setState({ prefixFilter });
    this.prefixFilterChangedDebounced();
  };

  private prefixFilterChangedDebounced = debounce(() => {
    this.applyMetricPrefixFilter();
    this.updateMetrics(false); // Only needed to applyMetricPrefixFilter
    this.buildLayout();
  }, 1000);

  public onTogglePreviews = () => {
    this.setState({ showPreviews: !this.state.showPreviews });
    this.buildLayout();
  };

  public static Component = ({ model }: SceneComponentProps<MetricSelectScene>) => {
    const { searchQuery, showPreviews, body, metricsAfterSearch, metricsAfterFilter, prefixFilter } = model.useState();
    const { children } = body.useState();
    const styles = useStyles2(getStyles);

    const metricNamesStatus = useVariableStatus(VAR_METRIC_NAMES, model);
    const tooStrict = children.length === 0 && (searchQuery || prefixFilter);
    const noMetrics = !metricNamesStatus.isLoading && model.currentMetricNames.size === 0;

    const isLoading = metricNamesStatus.isLoading && children.length === 0;

    const blockingMessage = isLoading
      ? undefined
      : (noMetrics && 'There are no results found. Try a different time range or a different data source.') ||
        (tooStrict && 'There are no results found. Try adjusting your search or filters.') ||
        undefined;

    const prefixError =
      prefixFilter && metricsAfterSearch != null && !metricsAfterFilter?.length
        ? 'The current prefix filter is not available with the current search terms.'
        : undefined;

    const disableSearch = metricNamesStatus.error || metricNamesStatus.isLoading;

    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Field label={'Search metrics'} className={styles.searchField}>
            <Input
              placeholder="Search metrics"
              prefix={<Icon name={'search'} />}
              value={searchQuery}
              onChange={model.onSearchQueryChange}
              disabled={disableSearch}
            />
          </Field>
          <InlineSwitch
            showLabel={true}
            label="Show previews"
            value={showPreviews}
            onChange={model.onTogglePreviews}
            disabled={disableSearch}
          />
        </div>
        <div className={styles.header}>
          <Field label="Filter by prefix" error={prefixError} invalid={!!prefixError}>
            <MetricCategoryCascader
              metricNames={metricsAfterSearch || []}
              onSelect={model.onPrefixFilterChange}
              disabled={disableSearch}
              initialValue={prefixFilter}
            />
          </Field>
        </div>
        {metricNamesStatus.error && (
          <Alert title="Unable to retrieve metric names" severity="error">
            <div>We are unable to connect to your data source. Double check your data source URL and credentials.</div>
            <div>({metricNamesStatus.error})</div>
          </Alert>
        )}
        <StatusWrapper {...{ isLoading, blockingMessage }}>
          <model.state.body.Component model={model.state.body} />
        </StatusWrapper>
      </div>
    );
  };
}

function getMetricNamesVariableSet() {
  return new SceneVariableSet({
    variables: [
      new QueryVariable({
        name: VAR_METRIC_NAMES,
        datasource: trailDS,
        hide: VariableHide.hideVariable,
        includeAll: true,
        defaultToAll: true,
        skipUrlSync: true,
        refresh: VariableRefresh.onTimeRangeChanged,
        query: { query: `label_values(${VAR_FILTERS_EXPR},__name__)`, refId: 'A' },
      }),
    ],
  });
}

function getCardPanelFor(metric: string) {
  return PanelBuilders.text()
    .setTitle(metric)
    .setHeaderActions(new SelectMetricAction({ metric, title: 'Select' }))
    .setOption('content', '')
    .build();
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
    }),
    headingWrapper: css({
      marginBottom: theme.spacing(0.5),
    }),
    header: css({
      flexGrow: 0,
      display: 'flex',
      gap: theme.spacing(2),
      marginBottom: theme.spacing(1),
      alignItems: 'flex-end',
    }),
    searchField: css({
      flexGrow: 1,
      marginBottom: 0,
    }),
  };
}

// Consider any sequence of characters not permitted for metric names as a sepratator
const splitSeparator = /[^a-z0-9_:]+/;

function createSearchRegExp(spaceSeparatedMetricNames?: string) {
  if (!spaceSeparatedMetricNames) {
    return null;
  }
  const searchParts = spaceSeparatedMetricNames
    ?.toLowerCase()
    .split(splitSeparator)
    .filter((part) => part.length > 0)
    .map((part) => `(?=(.*${part}.*))`);

  if (searchParts.length === 0) {
    return null;
  }

  const regex = searchParts.join('');
  //  (?=(.*expr1.*))(?=().*expr2.*))...
  // The ?=(...) lookahead allows us to match these in any order.
  return new RegExp(regex, 'igy');
}

function useVariableStatus(name: string, sceneObject: SceneObject) {
  const variable = sceneGraph.lookupVariable(name, sceneObject);

  const useVariableState = useCallback(() => {
    if (variable) {
      return variable.useState();
    }
    return undefined;
  }, [variable]);

  const { error, loading } = useVariableState() || {};

  return { isLoading: !!loading, error };
}
