import { css } from '@emotion/css';
import { debounce, isEqual } from 'lodash';
import { SyntheticEvent, useReducer } from 'react';

import { GrafanaTheme2, RawTimeRange, SelectableValue } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
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
  SceneVariable,
  SceneVariableSet,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { Alert, Field, Icon, IconButton, InlineSwitch, Input, Select, Tooltip, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { DataTrail } from '../DataTrail';
import { MetricScene } from '../MetricScene';
import { StatusWrapper } from '../StatusWrapper';
import { Node, Parser } from '../groop/parser';
import { getMetricDescription } from '../helpers/MetricDatasourceHelper';
import { reportExploreMetrics } from '../interactions';
import { getOtelTargets } from '../otel/api';
import { OtelTargetType } from '../otel/types';
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
  otelResources?: OtelTargetType[];
  otelResource?: string;
  metricPrefix?: string;
  showPreviews?: boolean;
  metricNames?: string[];
  metricNamesLoading?: boolean;
  metricNamesError?: string;
  metricNamesWarning?: string;
}

const ROW_PREVIEW_HEIGHT = '175px';
const ROW_CARD_HEIGHT = '64px';
const METRIC_PREFIX_ALL = 'all';
const OTEL_DEFAULT = 'none';

const MAX_METRIC_NAMES = 20000;

const viewByTooltip =
  'View by the metric prefix. A metric prefix is a single word at the beginning of the metric name, relevant to the domain the metric belongs to.';
const otelTooltip = 'Select an OTel target to filter metrics.';

export class MetricSelectScene extends SceneObjectBase<MetricSelectSceneState> implements SceneObjectWithUrlSync {
  private previewCache: Record<string, MetricPanel> = {};
  private ignoreNextUpdate = false;
  private _debounceRefreshMetricNames = debounce(() => this._refreshMetricNames(), 1000);

  constructor(state: Partial<MetricSelectSceneState>) {
    super({
      showPreviews: true,
      $variables: state.$variables,
      metricPrefix: state.metricPrefix ?? METRIC_PREFIX_ALL,
      otelResource: state.otelResource ?? OTEL_DEFAULT,
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
    onReferencedVariableValueChanged: (variable: SceneVariable) => {
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

    // add OTEL job and instance labels to filter metrics
    const selectedOtelResource = this.state.otelResource ?? '';
    if (selectedOtelResource && selectedOtelResource !== 'none') {
      const otelResource = JSON.parse(selectedOtelResource);
      matchTerms.push(`job="${otelResource.job}"`);
      matchTerms.push(`instance="${otelResource.instance}"`);
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
      const rootGroupNode = await this.generateGroups(metricNames);

      const otelResources = await this.generateOtelResources();

      this.setState({
        metricNames,
        rootGroup: rootGroupNode,
        otelResources: otelResources,
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

  /**
   * This calls the Prometheus data source with a query to get OTEL resources
   * @returns OtelResourcesType[], a collection of job&instance pairs on the `target_info` metric
   */
  private async generateOtelResources() {
    // call up in to the parent trail
    const trail = getTrailFor(this);
    // get the time range
    const timeRange: RawTimeRange | undefined = trail.state.$timeRange?.state;
    if (!timeRange) {
      return [];
    }
    // get the data source UID for making calls to the DS
    const datasourceUid = sceneGraph.interpolate(trail, VAR_DATASOURCE_EXPR);

    // call the DS to get the list
    // query the datasource with a variable query for metrics
    // get list of matching job and instance on target_info
    const resources = await getOtelTargets(datasourceUid, timeRange);

    return resources;
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

    if (!this.state.rootGroup) {
      const rootGroupNode = await this.generateGroups(this.state.metricNames);
      this.setState({ rootGroup: rootGroupNode });
    }

    const children = await this.populateFilterableViewLayout();
    const rowTemplate = this.state.showPreviews ? ROW_PREVIEW_HEIGHT : ROW_CARD_HEIGHT;
    this.state.body.setState({ children, autoRows: rowTemplate });
  }

  private async populateFilterableViewLayout() {
    const trail = getTrailFor(this);
    // Get the current filters to determine the count of them
    // Which is required for `getPreviewPanelFor`
    const filters = getFilters(this);

    let rootGroupNode = this.state.rootGroup;
    if (!rootGroupNode) {
      rootGroupNode = await this.generateGroups(this.state.metricNames);
      this.setState({ rootGroup: rootGroupNode });
    }

    const children: SceneFlexItem[] = [];

    for (const [groupKey, groupNode] of rootGroupNode.groups) {
      if (this.state.metricPrefix !== METRIC_PREFIX_ALL && this.state.metricPrefix !== groupKey) {
        continue;
      }

      for (const [_, value] of groupNode.groups) {
        const panels = await this.populatePanels(trail, filters, value.values);
        children.push(...panels);
      }

      const morePanelsMaybe = await this.populatePanels(trail, filters, groupNode.values);
      children.push(...morePanelsMaybe);
    }

    return children;
  }

  private async populatePanels(trail: DataTrail, filters: ReturnType<typeof getFilters>, values: string[]) {
    const currentFilterCount = filters?.length || 0;

    const previewPanelLayoutItems: SceneFlexItem[] = [];
    for (let index = 0; index < values.length; index++) {
      const metricName = values[index];
      const metric: MetricPanel = this.previewCache[metricName] ?? { name: metricName, index, loaded: false };
      const metadata = await trail.getMetricMetadata(metricName);
      const description = getMetricDescription(metadata);

      if (this.state.showPreviews) {
        if (metric.itemRef && metric.isPanel) {
          previewPanelLayoutItems.push(metric.itemRef.resolve());
          continue;
        }
        const panel = getPreviewPanelFor(metric.name, index, currentFilterCount, description);

        metric.itemRef = panel.getRef();
        metric.isPanel = true;
        previewPanelLayoutItems.push(panel);
      } else {
        const panel = new SceneCSSGridItem({
          $variables: new SceneVariableSet({
            variables: getVariablesWithMetricConstant(metric.name),
          }),
          body: getCardPanelFor(metric.name, description),
        });
        metric.itemRef = panel.getRef();
        metric.isPanel = false;
        previewPanelLayoutItems.push(panel);
      }
    }

    return previewPanelLayoutItems;
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
    this.buildLayout();
  };

  public onOtelFilterChange = (val: SelectableValue) => {
    this.setState({ otelResource: val.value });
    // do not debounce this because we are not typing
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
      rootGroup,
      metricPrefix,
      otelResources,
      otelResource,
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

    const otelOptions = otelResources?.map((r) => ({ label: JSON.stringify(r), value: JSON.stringify(r) })) ?? [];

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
          {/* Only show OTEL if the job&instance pairs exist in the DS on target_info */}
          {otelOptions.length > 0 && (
            <Field
              label={
                <div className={styles.displayOptionTooltip}>
                  <Trans>OTel filter</Trans>
                  <IconButton name={'info-circle'} size="sm" variant={'secondary'} tooltip={otelTooltip} />
                </div>
              }
              className={styles.displayOption}
            >
              <Select
                value={otelResource ?? 'none'}
                onChange={model.onOtelFilterChange}
                onOpenMenu={() => {
                  /* REPORT INTERACTION FOR OTEL */
                }}
                onCloseMenu={() => {
                  /* REPORT INTERACTION FOR OTEL */
                }}
                options={[
                  {
                    label: 'None',
                    value: OTEL_DEFAULT,
                  },
                  ...otelOptions,
                ]}
              />
            </Field>
          )}
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
