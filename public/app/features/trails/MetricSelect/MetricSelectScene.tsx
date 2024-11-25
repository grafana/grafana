import { css } from '@emotion/css';
import { debounce, isEqual } from 'lodash';
import { SyntheticEvent, useReducer } from 'react';

import { AdHocVariableFilter, GrafanaTheme2, RawTimeRange, SelectableValue } from '@grafana/data';
import { config, isFetchError } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
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
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneObjectWithUrlSync,
  SceneTimeRange,
  SceneVariableSet,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { Alert, Field, Icon, IconButton, InlineSwitch, Input, Select, Tooltip, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { getSelectedScopes } from 'app/features/scopes';

import { MetricScene } from '../MetricScene';
import { StatusWrapper } from '../StatusWrapper';
import { Node, Parser } from '../groop/parser';
import { getMetricDescription } from '../helpers/MetricDatasourceHelper';
import { reportExploreMetrics } from '../interactions';
import { setOtelExperienceToggleState } from '../services/store';
import {
  getVariablesWithMetricConstant,
  MetricSelectedEvent,
  RefreshMetricsEvent,
  VAR_DATASOURCE,
  VAR_DATASOURCE_EXPR,
  VAR_FILTERS,
} from '../shared';
import { getFilters, getTrailFor, isSceneTimeRangeState } from '../utils';

import { AddToExplorationButton } from './AddToExplorationsButton';
import { SelectMetricAction } from './SelectMetricAction';
import { getMetricNames } from './api';
import { getPreviewPanelFor } from './previewPanel';
import { sortRelatedMetrics } from './relatedMetrics';
import { createJSRegExpFromSearchTerms, createPromRegExp, deriveSearchTermsFromInput } from './util';

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
  metricPrefix?: string;
  metricNames?: string[];
  metricNamesLoading?: boolean;
  metricNamesError?: string;
  metricNamesWarning?: string;
}

const ROW_PREVIEW_HEIGHT = '175px';
const ROW_CARD_HEIGHT = '64px';
const METRIC_PREFIX_ALL = 'all';

const MAX_METRIC_NAMES = 20000;

const viewByTooltip =
  'View by the metric prefix. A metric prefix is a single word at the beginning of the metric name, relevant to the domain the metric belongs to.';

export class MetricSelectScene extends SceneObjectBase<MetricSelectSceneState> implements SceneObjectWithUrlSync {
  private previewCache: Record<string, MetricPanel> = {};
  private ignoreNextUpdate = false;
  private _debounceRefreshMetricNames = debounce(() => this._refreshMetricNames(), 1000);

  constructor(state: Partial<MetricSelectSceneState>) {
    super({
      $variables: state.$variables,
      metricPrefix: state.metricPrefix ?? METRIC_PREFIX_ALL,
      body:
        state.body ??
        new SceneCSSGridLayout({
          children: [],
          templateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
          autoRows: ROW_PREVIEW_HEIGHT,
          isLazy: true,
        }),
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['metricPrefix'] });
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE, VAR_FILTERS],
    onReferencedVariableValueChanged: () => {
      // In all cases, we want to reload the metric names
      this._debounceRefreshMetricNames();
    },
  });

  getUrlState() {
    return { metricPrefix: this.state.metricPrefix };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    if (typeof values.metricPrefix === 'string') {
      if (this.state.metricPrefix !== values.metricPrefix) {
        this.setState({ metricPrefix: values.metricPrefix });
      }
    }
  }

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

    this._subs.add(
      trail.subscribeToState(({ otelTargets }, oldState) => {
        // if the otel targets have changed, get the new list of metrics
        if (
          otelTargets?.instances !== oldState.otelTargets?.instances &&
          otelTargets?.jobs !== oldState.otelTargets?.jobs
        ) {
          this._debounceRefreshMetricNames();
        }
      })
    );

    this._subs.add(
      trail.subscribeToState(() => {
        // users will most likely not switch this off but for now,
        // update metric names when changing useOtelExperience
        this._debounceRefreshMetricNames();
      })
    );

    this._subs.add(
      trail.subscribeToState(() => {
        // move showPreviews into the settings
        // build layout when toggled
        this.buildLayout();
      })
    );

    if (config.featureToggles.enableScopesInMetricsExplore) {
      this._subs.add(
        trail.subscribeToEvent(RefreshMetricsEvent, () => {
          this._debounceRefreshMetricNames();
        })
      );
    }

    this._debounceRefreshMetricNames();
  }

  private async _refreshMetricNames() {
    const trail = getTrailFor(this);
    const timeRange: RawTimeRange | undefined = trail.state.$timeRange?.state;

    if (!timeRange) {
      return;
    }

    const filters: AdHocVariableFilter[] = [];

    const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, this);
    const adhocFilters = filtersVar instanceof AdHocFiltersVariable ? (filtersVar?.state.filters ?? []) : [];
    if (adhocFilters.length > 0) {
      filters.push(...adhocFilters);
    }

    const metricSearchRegex = createPromRegExp(trail.state.metricSearch);
    if (metricSearchRegex) {
      filters.push({
        key: '__name__',
        operator: '=~',
        value: metricSearchRegex,
      });
    }

    const datasourceUid = sceneGraph.interpolate(trail, VAR_DATASOURCE_EXPR);
    this.setState({ metricNamesLoading: true, metricNamesError: undefined, metricNamesWarning: undefined });

    try {
      const jobsList = trail.state.useOtelExperience ? (trail.state.otelTargets?.jobs ?? []) : [];
      const instancesList = trail.state.useOtelExperience ? (trail.state.otelTargets?.instances ?? []) : [];

      const response = await getMetricNames(
        datasourceUid,
        timeRange,
        getSelectedScopes(),
        filters,
        jobsList,
        instancesList,
        MAX_METRIC_NAMES
      );
      const searchRegex = createJSRegExpFromSearchTerms(getMetricSearch(this));
      let metricNames = searchRegex
        ? response.data.filter((metric) => !searchRegex || searchRegex.test(metric))
        : response.data;

      // use this to generate groups for metric prefix
      const filteredMetricNames = metricNames;

      // filter the remaining metrics with the metric prefix
      const metricPrefix = this.state.metricPrefix;
      if (metricPrefix && metricPrefix !== 'all') {
        const prefixRegex = new RegExp(`(^${metricPrefix}.*)`, 'igy');
        metricNames = metricNames.filter((metric) => !prefixRegex || prefixRegex.test(metric));
      }

      let metricNamesWarning = response.limitReached
        ? `This feature will only return up to ${MAX_METRIC_NAMES} metric names for performance reasons. ` +
          `This limit is being exceeded for the current data source. ` +
          `Add search terms or label filters to narrow down the number of metric names returned.`
        : undefined;

      // if there are no otel targets for otel resources, there will be no labels
      if (trail.state.useOtelExperience && (jobsList.length === 0 || instancesList.length === 0)) {
        metricNames = [];
        metricNamesWarning = undefined;
      }

      if (response.missingOtelTargets) {
        metricNamesWarning = `${metricNamesWarning ?? ''} The list of metrics is not complete. Select more OTel resource attributes to see a full list of metrics.`;
      }

      let bodyLayout = this.state.body;

      // generate groups based on the search metrics input
      let rootGroupNode = await this.generateGroups(filteredMetricNames);

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

  private async generateGroups(metricNames: string[] = []) {
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

      metricsMap[metricName] = oldPanel || { name: metricName, index, loaded: false };
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

  private async buildLayout() {
    const trail = getTrailFor(this);
    const showPreviews = trail.state.showPreviews;
    // Temp hack when going back to select metric scene and variable updates
    if (this.ignoreNextUpdate) {
      this.ignoreNextUpdate = false;
      return;
    }

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

      if (showPreviews) {
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

    const rowTemplate = showPreviews ? ROW_PREVIEW_HEIGHT : ROW_CARD_HEIGHT;

    this.state.body.setState({ children, autoRows: rowTemplate });
  }

  public updateMetricPanel = (metric: string, isLoaded?: boolean, isEmpty?: boolean) => {
    const metricPanel = this.previewCache[metric];
    if (metricPanel) {
      metricPanel.isEmpty = isEmpty;
      metricPanel.loaded = isLoaded;
      this.previewCache[metric] = metricPanel;
      if (this.state.metricPrefix === 'All') {
        this.buildLayout();
      }
    }
  };

  public onSearchQueryChange = (evt: SyntheticEvent<HTMLInputElement>) => {
    const metricSearch = evt.currentTarget.value;
    const trail = getTrailFor(this);
    // Update the variable
    trail.setState({ metricSearch });
  };

  public onPrefixFilterChange = (val: SelectableValue) => {
    this.setState({ metricPrefix: val.value });
    this._refreshMetricNames();
  };

  public reportPrefixFilterInteraction = (isMenuOpen: boolean) => {
    const trail = getTrailFor(this);
    const { steps, currentStep } = trail.state.history.state;
    const previousMetric = steps[currentStep]?.trailState.metric;
    const isRelatedMetricSelector = previousMetric !== undefined;

    reportExploreMetrics('prefix_filter_clicked', {
      from: isRelatedMetricSelector ? 'related_metrics' : 'metric_list',
      action: isMenuOpen ? 'open' : 'close',
    });
  };

  public onToggleOtelExperience = () => {
    const trail = getTrailFor(this);
    const useOtelExperience = trail.state.useOtelExperience;

    setOtelExperienceToggleState(!useOtelExperience);
    trail.setState({ useOtelExperience: !useOtelExperience });
  };

  public static Component = ({ model }: SceneComponentProps<MetricSelectScene>) => {
    const { body, metricNames, metricNamesError, metricNamesLoading, metricNamesWarning, rootGroup, metricPrefix } =
      model.useState();
    const { children } = body.useState();
    const trail = getTrailFor(model);
    const styles = useStyles2(getStyles);

    const [warningDismissed, dismissWarning] = useReducer(() => true, false);

    const { metricSearch, useOtelExperience, hasOtelResources, isStandardOtel } = trail.useState();

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
          <Field label={'Search metrics'} className={styles.searchField}>
            <Input
              placeholder="Search metrics"
              prefix={<Icon name={'search'} />}
              value={metricSearch}
              onChange={model.onSearchQueryChange}
              suffix={metricNamesWarningIcon}
            />
          </Field>
          <Field
            label={
              <div className={styles.displayOptionTooltip}>
                <Trans i18nKey="explore-metrics.viewBy">View by</Trans>
                <IconButton name={'info-circle'} size="sm" variant={'secondary'} tooltip={viewByTooltip} />
              </div>
            }
            className={styles.displayOption}
          >
            <Select
              value={metricPrefix}
              onChange={model.onPrefixFilterChange}
              onOpenMenu={() => model.reportPrefixFilterInteraction(true)}
              onCloseMenu={() => model.reportPrefixFilterInteraction(false)}
              options={[
                {
                  label: 'All metric names',
                  value: METRIC_PREFIX_ALL,
                },
                ...Array.from(rootGroup?.groups.keys() ?? []).map((g) => ({ label: `${g}_`, value: g })),
              ]}
            />
          </Field>
          {hasOtelResources && (
            <Field
              label={
                <div className={styles.displayOptionTooltip}>
                  <Trans i18nKey="trails.metric-select.filter-by">Filter by</Trans>
                  <IconButton
                    name={'info-circle'}
                    size="sm"
                    variant={'secondary'}
                    tooltip={
                      <Trans i18nKey="trails.metric-select.otel-switch">
                        This switch enables filtering by OTel resources for OTel native data sources.
                      </Trans>
                    }
                  />
                </div>
              }
              className={styles.displayOption}
            >
              <div
                title={
                  !isStandardOtel ? 'This setting is disabled because this is not an OTel native data source.' : ''
                }
              >
                <InlineSwitch
                  disabled={!isStandardOtel}
                  showLabel={true}
                  label="Otel experience"
                  value={useOtelExperience}
                  onChange={model.onToggleOtelExperience}
                />
              </div>
            </Field>
          )}
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
          {body instanceof SceneFlexLayout && <body.Component model={body} />}
          {body instanceof SceneCSSGridLayout && <body.Component model={body} />}
        </StatusWrapper>
      </div>
    );
  };
}

function getCardPanelFor(metric: string, description?: string) {
  return PanelBuilders.text()
    .setTitle(metric)
    .setDescription(description)
    .setHeaderActions([
      new SelectMetricAction({ metric, title: 'Select' }),
      new AddToExplorationButton({ labelName: metric }),
    ])
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
      minWidth: '184px',
    }),
    displayOptionTooltip: css({
      display: 'flex',
      gap: theme.spacing(1),
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
