import { css } from '@emotion/css';
import { debounce, isEqual } from 'lodash';
import React from 'react';

import { GrafanaTheme2, RawTimeRange } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import {
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneFlexItem,
  sceneGraph,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneObjectStateChangedEvent,
  SceneTimeRange,
  SceneVariable,
  SceneVariableSet,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { Input, InlineSwitch, Field, Alert, Icon, useStyles2 } from '@grafana/ui';

import { DataTrailHistory } from '../DataTrailsHistory';
import { MetricScene } from '../MetricScene';
import { StatusWrapper } from '../StatusWrapper';
import { getMetricDescription } from '../helpers/MetricDatasourceHelper';
import { reportExploreMetrics } from '../interactions';
import {
  getVariablesWithMetricConstant,
  MetricSelectedEvent,
  VAR_DATASOURCE,
  VAR_DATASOURCE_EXPR,
  VAR_FILTERS,
  VAR_METRIC_SEARCH_TERMS,
} from '../shared';
import { getFilters, getTrailFor, isSceneTimeRangeState } from '../utils';

import { MetricSearchTermsVariable } from './MetricSearchTermsVariable';
import { SelectMetricAction } from './SelectMetricAction';
import { getMetricNames } from './api';
import { getPreviewPanelFor } from './previewPanel';
import { sortRelatedMetrics } from './relatedMetrics';
import { createJSRegExpFromSearchTerms, deriveSearchTermsFromInput, getMetricSearchTerms } from './util';

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
  metricNames?: string[];
  metricNamesLoading?: boolean;
  metricNamesError?: string;
  metricNamesWarning?: string;
}

const ROW_PREVIEW_HEIGHT = '175px';
const ROW_CARD_HEIGHT = '64px';

const MAX_METRIC_NAMES = 20000;

export class MetricSelectScene extends SceneObjectBase<MetricSelectSceneState> {
  private previewCache: Record<string, MetricPanel> = {};
  private ignoreNextUpdate = false;

  constructor(state: Partial<MetricSelectSceneState>) {
    super({
      $variables: state.$variables,
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
    variableNames: [VAR_DATASOURCE, VAR_METRIC_SEARCH_TERMS, VAR_FILTERS],
    onReferencedVariableValueChanged: (variable: SceneVariable) => {
      // In all cases, we want to reload the metric names
      this._refreshMetricNames();
    },
  });

  private _onActivate() {
    if (this.state.body.state.children.length === 0) {
      this.buildLayout();
    } else {
      // Temp hack when going back to select metric scene and variable updates
      this.ignoreNextUpdate = true;
    }

    this._updateSearchQueryFromSearchTerms();

    const trail = getTrailFor(this);

    this._subs.add(
      trail.subscribeToEvent(MetricSelectedEvent, (event) => {
        const { steps, currentStep } = trail.state.history.state;
        const prevStep = steps[currentStep].parentIndex;
        const previousMetric = steps[prevStep].trailState.metric;
        const isRelatedMetricSelector = previousMetric !== undefined;

        if (event.payload !== undefined) {
          const searchTermCount = getMetricSearchTerms(trail).length;

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
        } else if (evt.payload.changedObject instanceof DataTrailHistory) {
          // If the history changes, our search terms might need an update
          this._updateSearchQueryFromSearchTerms();
        }
      })
    );

    this.subscribeToState((newState, prevState) => {
      if (newState.metricNames !== prevState.metricNames) {
        this.onMetricNamesChanged();
      }
    });

    this._refreshMetricNames();
  }

  private _updateSearchQueryFromSearchTerms() {
    this.setState({ searchQuery: getMetricSearchTerms(getTrailFor(this)).join(' ') });
  }

  private async _refreshMetricNames() {
    const trail = getTrailFor(this);
    const timeRange: RawTimeRange | undefined = trail.state.$timeRange?.state;

    if (!timeRange) {
      return;
    }

    const match = sceneGraph.interpolate(trail, '{${filters}${metricSearch:filter}}');
    const datasourceUid = sceneGraph.interpolate(trail, VAR_DATASOURCE_EXPR);
    this.setState({ metricNamesLoading: true, metricNamesError: undefined, metricNamesWarning: undefined });

    try {
      const response = await getMetricNames(datasourceUid, timeRange, match, MAX_METRIC_NAMES);
      const searchRegex = createJSRegExpFromSearchTerms(getMetricSearchTerms(trail));
      const metricNames = searchRegex
        ? response.data.filter((metric) => !searchRegex || searchRegex.test(metric))
        : response.data;

      const metricNamesWarning = response.limitReached
        ? `There are too many different metric names in this data source. ` +
          `Only the first ${MAX_METRIC_NAMES} metrics will be considered ` +
          `(i.e., from "${metricNames[0]}" to "${metricNames.at(-1)}"). ` +
          `Try entering some search terms or label filters to narrow down the number of metric names returned.`
        : undefined;

      this.setState({ metricNames, metricNamesLoading: false, metricNamesWarning, metricNamesError: response.error });
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
    this.buildLayout();
  }

  private async buildLayout() {
    // Temp hack when going back to select metric scene and variable updates
    if (this.ignoreNextUpdate) {
      this.ignoreNextUpdate = false;
      return;
    }

    const children: SceneFlexItem[] = [];

    const trail = getTrailFor(this);

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
    // Update the variable
    const searchTermsVariable = sceneGraph.lookupVariable(VAR_METRIC_SEARCH_TERMS, this);
    if (searchTermsVariable instanceof MetricSearchTermsVariable) {
      const terms = deriveSearchTermsFromInput(this.state.searchQuery || '');

      if (!isEqual(searchTermsVariable.state.terms, terms)) {
        searchTermsVariable.updateTerms(terms);
      }
    }
  }, 1000);

  public onTogglePreviews = () => {
    this.setState({ showPreviews: !this.state.showPreviews });
    this.buildLayout();
  };

  public static Component = ({ model }: SceneComponentProps<MetricSelectScene>) => {
    const { searchQuery, showPreviews, body, metricNames, metricNamesError, metricNamesLoading, metricNamesWarning } =
      model.useState();
    const { children } = body.useState();
    const styles = useStyles2(getStyles);

    const tooStrict = children.length === 0 && searchQuery;
    const noMetrics = !metricNamesLoading && metricNames && metricNames.length === 0;

    const isLoading = metricNamesLoading && children.length === 0;

    const blockingMessage = isLoading
      ? undefined
      : (noMetrics && 'There are no results found. Try a different time range or a different data source.') ||
        (tooStrict && 'There are no results found. Try adjusting your search or filters.') ||
        undefined;

    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Field label={'Search metrics'} className={styles.searchField}>
            <Input
              placeholder="Search metrics"
              prefix={<Icon name={'search'} />}
              value={searchQuery || ''}
              onChange={model.onSearchQueryChange}
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
        {metricNamesWarning && (
          <Alert title="Unable to retrieve all metric names" severity="warning">
            <div>{metricNamesWarning}</div>
          </Alert>
        )}
        <StatusWrapper {...{ isLoading, blockingMessage }}>
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
      flexGrow: 1,
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
  };
}
