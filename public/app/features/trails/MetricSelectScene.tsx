import { css } from '@emotion/css';
import leven from 'leven';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  PanelBuilders,
  QueryVariable,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneFlexItem,
  sceneGraph,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneQueryRunner,
  SceneVariableSet,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { Field, Icon, InlineSwitch, Input, LoadingPlaceholder, useStyles2 } from '@grafana/ui';

import { getAutoQueriesForMetric } from './AutomaticMetricQueries/AutoQueryEngine';
import { MetricCategoryCascader } from './MetricCategory/MetricCategoryCascader';
import { MetricScene } from './MetricScene';
import { SelectMetricAction } from './SelectMetricAction';
import { hideEmptyPreviews } from './hideEmptyPreviews';
import { getVariablesWithMetricConstant, trailDS, VAR_FILTERS_EXPR, VAR_METRIC_NAMES } from './shared';
import { getColorByIndex, getTrailFor } from './utils';

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
    variableNames: [VAR_METRIC_NAMES],
    onVariableUpdateCompleted: this.onVariableUpdateCompleted.bind(this),
  });

  private onVariableUpdateCompleted(): void {
    this.updateMetrics(); // Entire pipeline must be performed
    this.buildLayout();
  }

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

  private getAllMetricNames() {
    // Get the datasource metrics list from the VAR_METRIC_NAMES variable
    const variable = sceneGraph.lookupVariable(VAR_METRIC_NAMES, this);

    if (!(variable instanceof QueryVariable)) {
      return null;
    }

    if (variable.state.loading) {
      return null;
    }

    const metricNames = variable.state.options.map((option) => option.value.toString());
    return metricNames;
  }

  private applyMetricSearch() {
    // This should only occur when the `searchQuery` changes, of if the `metricNames` change
    const metricNames = this.getAllMetricNames();
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

    for (let index = 0; index < sortedMetricNames.length; index++) {
      const metricName = sortedMetricNames[index];

      if (Object.keys(metricsMap).length > metricsLimit) {
        break;
      }

      metricsMap[metricName] = { name: metricName, index, loaded: false };
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
    for (let index = 0; index < metricsList.length; index++) {
      const metric = metricsList[index];

      if (this.state.showPreviews) {
        if (metric.itemRef && metric.isPanel) {
          children.push(metric.itemRef.resolve());
          continue;
        }
        const panel = getPreviewPanelFor(metric.name, index);
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

  public onSearchChange = (evt: React.SyntheticEvent<HTMLInputElement>) => {
    this.setState({ searchQuery: evt.currentTarget.value });
    this.updateMetrics(); // Need to repeat entire pipeline
    this.buildLayout();
  };

  public onPrefixFilterChange = (prefixFilter: string | undefined) => {
    this.setState({ prefixFilter });
    this.applyMetricPrefixFilter();
    this.updateMetrics(false); // Only needed to applyMetricPrefixFilter
    this.buildLayout();
  };

  public onTogglePreviews = () => {
    this.setState({ showPreviews: !this.state.showPreviews });
    this.buildLayout();
  };

  public static Component = ({ model }: SceneComponentProps<MetricSelectScene>) => {
    const { searchQuery, showPreviews, body, metricsAfterSearch, metricsAfterFilter, prefixFilter } = model.useState();
    const { children } = body.useState();
    const styles = useStyles2(getStyles);

    const notLoaded = metricsAfterSearch === undefined && metricsAfterFilter === undefined && children.length === 0;

    const tooStrict = children.length === 0 && (searchQuery || prefixFilter);

    let status =
      (notLoaded && <LoadingPlaceholder className={styles.statusMessage} text="Loading..." />) ||
      (tooStrict && 'There are no results found. Try adjusting your search or filters.');

    const showStatus = status && <div className={styles.statusMessage}>{status}</div>;

    const prefixError =
      prefixFilter && metricsAfterSearch != null && !metricsAfterFilter?.length
        ? 'The current prefix filter is not available with the current search terms.'
        : undefined;

    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Field label={'Search metrics'} className={styles.searchField}>
            <Input
              placeholder="Search metrics"
              prefix={<Icon name={'search'} />}
              value={searchQuery}
              onChange={model.onSearchChange}
            />
          </Field>
          <InlineSwitch showLabel={true} label="Show previews" value={showPreviews} onChange={model.onTogglePreviews} />
        </div>
        <div className={styles.header}>
          <Field label="Filter by prefix" error={prefixError} invalid={true}>
            <MetricCategoryCascader
              metricNames={metricsAfterSearch || []}
              onSelect={model.onPrefixFilterChange}
              disabled={metricsAfterSearch == null}
              initialValue={prefixFilter}
            />
          </Field>
        </div>
        {showStatus}
        <model.state.body.Component model={model.state.body} />
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
        query: { query: `label_values(${VAR_FILTERS_EXPR},__name__)`, refId: 'A' },
      }),
    ],
  });
}

function getPreviewPanelFor(metric: string, index: number) {
  const autoQuery = getAutoQueriesForMetric(metric);

  const vizPanel = autoQuery.preview
    .vizBuilder()
    .setColor({ mode: 'fixed', fixedColor: getColorByIndex(index) })
    .setHeaderActions(new SelectMetricAction({ metric, title: 'Select' }))
    .build();

  return new SceneCSSGridItem({
    $variables: new SceneVariableSet({
      variables: getVariablesWithMetricConstant(metric),
    }),
    $behaviors: [hideEmptyPreviews(metric)],
    $data: new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: 200,
      queries: autoQuery.preview.queries,
    }),
    body: vizPanel,
  });
}

function getCardPanelFor(metric: string) {
  return PanelBuilders.text()
    .setTitle(metric)
    .setHeaderActions(new SelectMetricAction({ metric, title: 'Select' }))
    .setOption('content', '')
    .build();
}

// Computes the Levenshtein distance between two strings, twice, once for the first half and once for the whole string.
function sortRelatedMetrics(metricList: string[], metric: string) {
  return metricList.sort((aValue, bValue) => {
    const aSplit = aValue.split('_');
    const aHalf = aSplit.slice(0, aSplit.length / 2).join('_');

    const bSplit = bValue.split('_');
    const bHalf = bSplit.slice(0, bSplit.length / 2).join('_');

    return (
      (leven(aHalf, metric!) || 0 + (leven(aValue, metric!) || 0)) -
      (leven(bHalf, metric!) || 0 + (leven(bValue, metric!) || 0))
    );
  });
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
    statusMessage: css({
      fontStyle: 'italic',
      marginTop: theme.spacing(7),
      textAlign: 'center',
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
