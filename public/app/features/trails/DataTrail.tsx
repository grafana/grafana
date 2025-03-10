import { css } from '@emotion/css';
import { useEffect, useRef } from 'react';

import { AdHocVariableFilter, GrafanaTheme2, RawTimeRange, urlUtil, VariableHide } from '@grafana/data';
import { PromQuery } from '@grafana/prometheus';
import { locationService, useChromeHeaderHeight } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  ConstantVariable,
  CustomVariable,
  DataSourceVariable,
  SceneComponentProps,
  SceneControlsSpacer,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneObjectWithUrlSync,
  SceneQueryRunner,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  sceneUtils,
  SceneVariable,
  SceneVariableSet,
  UrlSyncContextProvider,
  UrlSyncManager,
  VariableDependencyConfig,
  VariableValueSelectors,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { getSelectedScopes } from 'app/features/scopes';

import { DataTrailSettings } from './DataTrailSettings';
import { DataTrailHistory } from './DataTrailsHistory';
import { MetricScene } from './MetricScene';
import { MetricSelectScene } from './MetricSelect/MetricSelectScene';
import { MetricsHeader } from './MetricsHeader';
import { getTrailStore } from './TrailStore/TrailStore';
import { NativeHistogramBanner } from './banners/NativeHistogramBanner';
import { MetricDatasourceHelper } from './helpers/MetricDatasourceHelper';
import { reportChangeInLabelFilters, reportExploreMetrics } from './interactions';
import { migrateOtelDeploymentEnvironment } from './migrations/otelDeploymentEnvironment';
import { getDeploymentEnvironments, getNonPromotedOtelResources, totalOtelResources } from './otel/api';
import { OtelTargetType } from './otel/types';
import { manageOtelAndMetricFilters, updateOtelData, updateOtelJoinWithGroupLeft } from './otel/util';
import {
  getVariablesWithOtelJoinQueryConstant,
  MetricSelectedEvent,
  trailDS,
  VAR_DATASOURCE,
  VAR_DATASOURCE_EXPR,
  VAR_FILTERS,
  VAR_MISSING_OTEL_TARGETS,
  VAR_OTEL_AND_METRIC_FILTERS,
  VAR_OTEL_DEPLOYMENT_ENV,
  VAR_OTEL_GROUP_LEFT,
  VAR_OTEL_JOIN_QUERY,
  VAR_OTEL_RESOURCES,
} from './shared';
import { getTrailFor, limitAdhocProviders } from './utils';

export interface DataTrailState extends SceneObjectState {
  topScene?: SceneObject;
  embedded?: boolean;
  controls: SceneObject[];
  history: DataTrailHistory;
  settings: DataTrailSettings;
  createdAt: number;

  // just for the starting data source
  initialDS?: string;
  initialFilters?: AdHocVariableFilter[];

  // this is for otel, if the data source has it, it will be updated here
  hasOtelResources?: boolean;
  useOtelExperience?: boolean;
  otelTargets?: OtelTargetType; // all the targets with job and instance regex, job=~"<job-v>|<job-v>"", instance=~"<instance-v>|<instance-v>"
  otelJoinQuery?: string;
  isStandardOtel?: boolean;
  nonPromotedOtelResources?: string[];
  initialOtelCheckComplete?: boolean; // updated after the first otel check
  startButtonClicked?: boolean; // from original landing page
  afterFirstOtelCheck?: boolean; // when starting there is always a DS var change from variable dependency
  resettingOtel?: boolean; // when switching OTel off from the switch
  isUpdatingOtel?: boolean;
  addingLabelFromBreakdown?: boolean; // do not use the otel and metrics var subscription when adding label from the breakdown

  // moved into settings
  showPreviews?: boolean;

  // Synced with url
  metric?: string;
  metricSearch?: string;

  histogramsLoaded: boolean;
  nativeHistograms: string[];
  nativeHistogramMetric: string;
}

export class DataTrail extends SceneObjectBase<DataTrailState> implements SceneObjectWithUrlSync {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['metric', 'metricSearch', 'showPreviews', 'nativeHistogramMetric'],
  });

  public constructor(state: Partial<DataTrailState>) {
    super({
      $timeRange: state.$timeRange ?? new SceneTimeRange({}),
      // the initial variables should include a metric for metric scene and the otelJoinQuery.
      // NOTE: The other OTEL filters should be included too before this work is merged
      $variables:
        state.$variables ?? getVariableSet(state.initialDS, state.metric, state.initialFilters, state.otelJoinQuery),
      controls: state.controls ?? [
        new VariableValueSelectors({ layout: 'vertical' }),
        new SceneControlsSpacer(),
        new SceneTimePicker({}),
        new SceneRefreshPicker({}),
      ],
      history: state.history ?? new DataTrailHistory({}),
      settings: state.settings ?? new DataTrailSettings({}),
      createdAt: state.createdAt ?? new Date().getTime(),
      // default to false but update this to true on updateOtelData()
      // or true if the user either turned on the experience
      useOtelExperience: state.useOtelExperience ?? false,
      // preserve the otel join query
      otelJoinQuery: state.otelJoinQuery ?? '',
      showPreviews: state.showPreviews ?? true,
      nativeHistograms: state.nativeHistograms ?? [],
      histogramsLoaded: state.histogramsLoaded ?? false,
      nativeHistogramMetric: state.nativeHistogramMetric ?? '',
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  public _onActivate() {
    const urlParams = urlUtil.getUrlSearchParams();
    migrateOtelDeploymentEnvironment(this, urlParams);

    if (!this.state.topScene) {
      this.setState({ topScene: getTopSceneFor(this.state.metric) });
    }

    // Some scene elements publish this
    this.subscribeToEvent(MetricSelectedEvent, this._handleMetricSelectedEvent.bind(this));

    const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (filtersVariable instanceof AdHocFiltersVariable) {
      this._subs.add(
        filtersVariable?.subscribeToState((newState, prevState) => {
          if (!this._addingFilterWithoutReportingInteraction) {
            reportChangeInLabelFilters(newState.filters, prevState.filters);
          }
        })
      );
    }

    // This is for OTel consolidation filters
    // whenever the otel and metric filter is updated,
    // we need to add that filter to the correct otel resource var or var filter
    // so the filter can be interpolated in the query correctly
    const otelAndMetricsFiltersVariable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, this);
    const otelFiltersVariable = sceneGraph.lookupVariable(VAR_OTEL_RESOURCES, this);
    if (
      otelAndMetricsFiltersVariable instanceof AdHocFiltersVariable &&
      otelFiltersVariable instanceof AdHocFiltersVariable &&
      filtersVariable instanceof AdHocFiltersVariable
    ) {
      this._subs.add(
        otelAndMetricsFiltersVariable?.subscribeToState((newState, prevState) => {
          // identify the added, updated or removed variables and update the correct filter,
          // either the otel resource or the var filter
          // do not update on switching on otel experience or the initial check
          // do not update when selecting a label from metric scene breakdown
          if (
            this.state.useOtelExperience &&
            this.state.initialOtelCheckComplete &&
            !this.state.addingLabelFromBreakdown
          ) {
            const nonPromotedOtelResources = this.state.nonPromotedOtelResources ?? [];
            manageOtelAndMetricFilters(
              newState.filters,
              prevState.filters,
              nonPromotedOtelResources,
              otelFiltersVariable,
              filtersVariable
            );
          }
        })
      );
    }

    // Save the current trail as a recent (if the browser closes or reloads) if user selects a metric OR applies filters to metric select view
    const saveRecentTrail = () => {
      const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, this);
      const hasFilters = filtersVariable instanceof AdHocFiltersVariable && filtersVariable.state.filters.length > 0;
      if (this.state.metric || hasFilters) {
        getTrailStore().setRecentTrail(this);
      }
    };
    window.addEventListener('unload', saveRecentTrail);

    return () => {
      if (!this.state.embedded) {
        saveRecentTrail();
      }
      window.removeEventListener('unload', saveRecentTrail);
    };
  }

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE, VAR_OTEL_RESOURCES, VAR_OTEL_JOIN_QUERY, VAR_OTEL_AND_METRIC_FILTERS],
    onReferencedVariableValueChanged: async (variable: SceneVariable) => {
      const { name } = variable.state;

      if (name === VAR_DATASOURCE) {
        this.datasourceHelper.reset();

        // reset native histograms
        this.resetNativeHistograms();

        if (this.state.afterFirstOtelCheck) {
          // we need a new check for OTel
          this.setState({ initialOtelCheckComplete: false });
          // clear out the OTel filters, do not clear out var filters
          this.resetOtelExperience();
        }
        // fresh check for otel experience
        this.checkDataSourceForOTelResources();
      }

      // update otel variables when changed
      if (this.state.useOtelExperience && name === VAR_OTEL_RESOURCES && this.state.initialOtelCheckComplete) {
        // for state and variables
        const timeRange: RawTimeRange | undefined = this.state.$timeRange?.state;
        const datasourceUid = sceneGraph.interpolate(this, VAR_DATASOURCE_EXPR);
        if (timeRange) {
          updateOtelData(this, datasourceUid, timeRange);
        }
      }
    },
  });

  /**
   * Assuming that the change in filter was already reported with a cause other than `'adhoc_filter'`,
   * this will modify the adhoc filter variable and prevent the automatic reporting which would
   * normally occur through the call to `reportChangeInLabelFilters`.
   */
  public addFilterWithoutReportingInteraction(filter: AdHocVariableFilter) {
    const variable = sceneGraph.lookupVariable('filters', this);
    const otelAndMetricsFiltersVariable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, this);
    if (
      !(variable instanceof AdHocFiltersVariable) ||
      !(otelAndMetricsFiltersVariable instanceof AdHocFiltersVariable)
    ) {
      return;
    }

    this._addingFilterWithoutReportingInteraction = true;
    if (this.state.useOtelExperience) {
      otelAndMetricsFiltersVariable.setState({ filters: [...otelAndMetricsFiltersVariable.state.filters, filter] });
    } else {
      variable.setState({ filters: [...variable.state.filters, filter] });
    }
    this._addingFilterWithoutReportingInteraction = false;
  }

  private _addingFilterWithoutReportingInteraction = false;
  private datasourceHelper = new MetricDatasourceHelper(this);

  public getMetricMetadata(metric?: string) {
    return this.datasourceHelper.getMetricMetadata(metric);
  }

  public isNativeHistogram(metric: string) {
    return this.datasourceHelper.isNativeHistogram(metric);
  }

  // use this to initialize histograms in all scenes
  public async initializeHistograms() {
    if (!this.state.histogramsLoaded) {
      await this.datasourceHelper.initializeHistograms();

      this.setState({
        nativeHistograms: this.listNativeHistograms(),
        histogramsLoaded: true,
      });
    }
  }

  public listNativeHistograms() {
    return this.datasourceHelper.listNativeHistograms() ?? [];
  }

  private resetNativeHistograms() {
    this.setState({
      histogramsLoaded: false,
      nativeHistograms: [],
    });
  }

  public getCurrentMetricMetadata() {
    return this.getMetricMetadata(this.state.metric);
  }

  public restoreFromHistoryStep(state: DataTrailState) {
    if (!state.topScene && !state.metric) {
      // If the top scene for an  is missing, correct it.
      state.topScene = new MetricSelectScene({});
    }

    this.setState(
      sceneUtils.cloneSceneObjectState(state, {
        history: this.state.history,
        metric: !state.metric ? undefined : state.metric,
        metricSearch: !state.metricSearch ? undefined : state.metricSearch,
        // store type because this requires an expensive api call to determine
        // when loading the metric scene
        nativeHistogramMetric: !state.nativeHistogramMetric ? undefined : state.nativeHistogramMetric,
      })
    );

    const urlState = new UrlSyncManager().getUrlState(this);
    const fullUrl = urlUtil.renderUrl(locationService.getLocation().pathname, urlState);
    locationService.replace(fullUrl);
  }

  private async _handleMetricSelectedEvent(evt: MetricSelectedEvent) {
    const metric = evt.payload ?? '';

    if (this.state.useOtelExperience) {
      await updateOtelJoinWithGroupLeft(this, metric);
    }

    // from the metric preview panel we have the info loaded to determine that a metric is a native histogram
    let nativeHistogramMetric = false;
    if (this.isNativeHistogram(metric)) {
      nativeHistogramMetric = true;
    }

    this.setState(this.getSceneUpdatesForNewMetricValue(metric, nativeHistogramMetric));

    // Add metric to adhoc filters baseFilter
    const filterVar = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (filterVar instanceof AdHocFiltersVariable) {
      filterVar.setState({
        baseFilters: getBaseFiltersForMetric(evt.payload),
      });
    }
  }

  private getSceneUpdatesForNewMetricValue(metric: string | undefined, nativeHistogramMetric?: boolean) {
    const stateUpdate: Partial<DataTrailState> = {};
    stateUpdate.metric = metric;
    // refactoring opportunity? Or do we pass metric knowledge all the way down?
    // must pass this native histogram prometheus knowledge deep into
    // the topscene set on the trail > MetricScene > getAutoQueriesForMetric() > createHistogramMetricQueryDefs();
    stateUpdate.nativeHistogramMetric = nativeHistogramMetric ? '1' : '';
    stateUpdate.topScene = getTopSceneFor(metric, nativeHistogramMetric);
    return stateUpdate;
  }

  getUrlState(): SceneObjectUrlValues {
    const { metric, metricSearch, showPreviews, nativeHistogramMetric } = this.state;
    return {
      metric,
      metricSearch,
      ...{ showPreviews: showPreviews === false ? 'false' : null },
      // store the native histogram knowledge in url for the metric scene
      nativeHistogramMetric,
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<DataTrailState> = {};

    if (typeof values.metric === 'string') {
      if (this.state.metric !== values.metric) {
        // if we have a metric and we have stored in the url that it is a native histogram
        // we can pass that info into the metric scene to generate the appropriate queries
        let nativeHistogramMetric = false;
        if (values.nativeHistogramMetric === '1') {
          nativeHistogramMetric = true;
        }

        Object.assign(stateUpdate, this.getSceneUpdatesForNewMetricValue(values.metric, nativeHistogramMetric));
      }
    } else if (values.metric == null) {
      stateUpdate.metric = undefined;
      stateUpdate.topScene = new MetricSelectScene({});
    }

    if (typeof values.metricSearch === 'string') {
      stateUpdate.metricSearch = values.metricSearch;
    } else if (values.metric == null) {
      stateUpdate.metricSearch = undefined;
    }

    if (typeof values.showPreviews === 'string') {
      stateUpdate.showPreviews = values.showPreviews !== 'false';
    }

    this.setState(stateUpdate);
  }

  /**
   * Check that the data source has otel resources
   * Check that the data source is standard for OTEL
   * Show a warning if not
   * Update the following variables:
   * otelResources (filters), otelJoinQuery (used in the query)
   * Enable the otel experience
   *
   * @returns
   */
  public async checkDataSourceForOTelResources() {
    // call up in to the parent trail
    const trail = getTrailFor(this);

    // get the time range
    const timeRange: RawTimeRange | undefined = trail.state.$timeRange?.state;

    if (timeRange) {
      const datasourceUid = sceneGraph.interpolate(trail, VAR_DATASOURCE_EXPR);
      const otelTargets = await totalOtelResources(datasourceUid, timeRange);
      const deploymentEnvironments = await getDeploymentEnvironments(datasourceUid, timeRange, getSelectedScopes());
      const hasOtelResources = otelTargets.jobs.length > 0 && otelTargets.instances.length > 0;
      // loading from the url with otel resources selected will result in turning on OTel experience
      const otelResourcesVariable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, this);
      let previouslyUsedOtelResources = false;
      if (otelResourcesVariable instanceof AdHocFiltersVariable) {
        previouslyUsedOtelResources = otelResourcesVariable.state.filters.length > 0;
      }

      // Future refactor: non promoted resources could be the full check
      //   - remove hasOtelResources
      //   - remove deployment environments as a check
      const nonPromotedOtelResources = await getNonPromotedOtelResources(datasourceUid, timeRange);

      // This is the function that will turn on OTel for the entire app.
      // The conditions to use this function are
      // 1. must be an otel data source
      // 2. Do not turn it on if the start button was clicked
      // 3. Url or bookmark has previous otel filters
      // 4. We are restting OTel with the toggle switch
      if (
        hasOtelResources &&
        nonPromotedOtelResources && // it is an otel data source
        !this.state.startButtonClicked && // we are not starting from the start button
        (previouslyUsedOtelResources || this.state.resettingOtel) // there are otel filters or we are restting
      ) {
        // HERE WE START THE OTEL EXPERIENCE ENGINE
        // 1. Set deployment variable values
        // 2. update all other variables and state
        updateOtelData(
          this,
          datasourceUid,
          timeRange,
          deploymentEnvironments,
          hasOtelResources,
          nonPromotedOtelResources
        );
      } else {
        this.resetOtelExperience(hasOtelResources, nonPromotedOtelResources);
      }
    }
  }

  resetOtelExperience(hasOtelResources?: boolean, nonPromotedResources?: string[]) {
    const otelResourcesVariable = sceneGraph.lookupVariable(VAR_OTEL_RESOURCES, this);
    const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, this);
    const otelAndMetricsFiltersVariable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, this);
    const otelJoinQueryVariable = sceneGraph.lookupVariable(VAR_OTEL_JOIN_QUERY, this);

    if (
      !(
        otelResourcesVariable instanceof AdHocFiltersVariable &&
        filtersVariable instanceof AdHocFiltersVariable &&
        otelAndMetricsFiltersVariable instanceof AdHocFiltersVariable &&
        otelJoinQueryVariable instanceof ConstantVariable
      )
    ) {
      return;
    }

    // show the var filters normally
    filtersVariable.setState({
      addFilterButtonText: 'Add label',
      label: 'Select label',
      hide: VariableHide.hideLabel,
    });
    // Resetting the otel experience filters means clearing both the otel resources var and the otelMetricsVar
    // hide the super otel and metric filter and reset it
    otelAndMetricsFiltersVariable.setState({
      filters: [],
      hide: VariableHide.hideVariable,
    });

    // if there are no resources reset the otel variables and otel state
    // or if not standard
    otelResourcesVariable.setState({
      filters: [],
      defaultKeys: [],
      hide: VariableHide.hideVariable,
    });

    otelJoinQueryVariable.setState({ value: '' });

    // potential full reset when a data source fails the check or is the initial check with turning off
    if (hasOtelResources && nonPromotedResources) {
      this.setState({
        hasOtelResources,
        isStandardOtel: nonPromotedResources.length > 0,
        useOtelExperience: false,
        otelTargets: { jobs: [], instances: [] },
        otelJoinQuery: '',
        afterFirstOtelCheck: true,
        initialOtelCheckComplete: true,
        isUpdatingOtel: false,
      });
    } else {
      // partial reset when a user turns off the otel experience
      this.setState({
        otelTargets: { jobs: [], instances: [] },
        otelJoinQuery: '',
        useOtelExperience: false,
        afterFirstOtelCheck: true,
        initialOtelCheckComplete: true,
        isUpdatingOtel: false,
      });
    }
  }

  public getQueries(): PromQuery[] {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const sqrs = sceneGraph.findAllObjects(this, (b) => b instanceof SceneQueryRunner) as SceneQueryRunner[];

    return sqrs.reduce<PromQuery[]>((acc, sqr) => {
      acc.push(
        ...sqr.state.queries.map((q) => ({
          ...q,
          expr: sceneGraph.interpolate(sqr, q.expr),
        }))
      );

      return acc;
    }, []);
  }

  static Component = ({ model }: SceneComponentProps<DataTrail>) => {
    const {
      controls,
      topScene,
      history,
      settings,
      useOtelExperience,
      hasOtelResources,
      embedded,
      histogramsLoaded,
      nativeHistograms,
    } = model.useState();

    const chromeHeaderHeight = useChromeHeaderHeight();
    const styles = useStyles2(getStyles, embedded ? 0 : (chromeHeaderHeight ?? 0));
    const showHeaderForFirstTimeUsers = getTrailStore().recent.length < 2;
    // need to initialize this here and not on activate because it requires the data source helper to be fully initialized first
    model.initializeHistograms();

    useEffect(() => {
      if (model.state.addingLabelFromBreakdown) {
        return;
      }

      if (!useOtelExperience && model.state.afterFirstOtelCheck) {
        // if the experience has been turned off, reset the otel variables
        model.resetOtelExperience();
      } else {
        // if experience is enabled, check standardization and update the otel variables
        model.checkDataSourceForOTelResources();
      }
    }, [model, hasOtelResources, useOtelExperience]);

    useEffect(() => {
      const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, model);
      const otelAndMetricsFiltersVariable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, model);
      const limitedFilterVariable = useOtelExperience ? otelAndMetricsFiltersVariable : filtersVariable;
      const datasourceHelper = model.datasourceHelper;
      limitAdhocProviders(model, limitedFilterVariable, datasourceHelper);
    }, [model, useOtelExperience]);

    const reportOtelExperience = useRef(false);
    // only report otel experience once
    if (useOtelExperience && !reportOtelExperience.current) {
      reportExploreMetrics('otel_experience_used', {});
      reportOtelExperience.current = true;
    }

    return (
      <div className={styles.container}>
        {NativeHistogramBanner({ histogramsLoaded, nativeHistograms, trail: model })}
        {showHeaderForFirstTimeUsers && <MetricsHeader />}
        <history.Component model={history} />
        {controls && (
          <div className={styles.controls}>
            {controls.map((control) => (
              <control.Component key={control.state.key} model={control} />
            ))}
            <settings.Component model={settings} />
          </div>
        )}
        {topScene && (
          <UrlSyncContextProvider scene={topScene}>
            <div className={styles.body}>{topScene && <topScene.Component model={topScene} />}</div>
          </UrlSyncContextProvider>
        )}
      </div>
    );
  };
}

export function getTopSceneFor(metric?: string, nativeHistogram?: boolean) {
  if (metric) {
    return new MetricScene({ metric: metric, nativeHistogram: nativeHistogram ?? false });
  } else {
    return new MetricSelectScene({});
  }
}

function getVariableSet(
  initialDS?: string,
  metric?: string,
  initialFilters?: AdHocVariableFilter[],
  otelJoinQuery?: string
) {
  return new SceneVariableSet({
    variables: [
      new DataSourceVariable({
        name: VAR_DATASOURCE,
        label: 'Data source',
        description: 'Only prometheus data sources are supported',
        value: initialDS,
        pluginId: 'prometheus',
      }),
      new AdHocFiltersVariable({
        name: VAR_OTEL_RESOURCES,
        label: 'Select resource attributes',
        addFilterButtonText: 'Select resource attributes',
        datasource: trailDS,
        hide: VariableHide.hideVariable,
        layout: 'combobox',
        defaultKeys: [],
        applyMode: 'manual',
        allowCustomValue: true,
      }),
      new AdHocFiltersVariable({
        name: VAR_FILTERS,
        addFilterButtonText: 'Add label',
        datasource: trailDS,
        // default to use var filters and have otel off
        hide: VariableHide.hideLabel,
        layout: 'combobox',
        filters: initialFilters ?? [],
        baseFilters: getBaseFiltersForMetric(metric),
        applyMode: 'manual',
        allowCustomValue: true,
        expressionBuilder: (filters: AdHocVariableFilter[]) => {
          return [...getBaseFiltersForMetric(metric), ...filters]
            .map((filter) => `${filter.key}${filter.operator}"${filter.value}"`)
            .join(',');
        },
      }),
      ...getVariablesWithOtelJoinQueryConstant(otelJoinQuery ?? ''),
      new ConstantVariable({
        name: VAR_OTEL_GROUP_LEFT,
        value: undefined,
        hide: VariableHide.hideVariable,
      }),
      new ConstantVariable({
        name: VAR_MISSING_OTEL_TARGETS,
        hide: VariableHide.hideVariable,
        value: false,
      }),
      new AdHocFiltersVariable({
        name: VAR_OTEL_AND_METRIC_FILTERS,
        addFilterButtonText: 'Filter',
        datasource: trailDS,
        hide: VariableHide.hideVariable,
        layout: 'combobox',
        filters: initialFilters ?? [],
        baseFilters: getBaseFiltersForMetric(metric),
        applyMode: 'manual',
        allowCustomValue: true,
        // skipUrlSync: true
      }),
      // Legacy variable needed for bookmarking which is necessary because
      // url sync method does not handle multiple dep env values
      // Remove this when the rudderstack event "deployment_environment_migrated" tapers off
      new CustomVariable({
        name: VAR_OTEL_DEPLOYMENT_ENV,
        label: 'Deployment environment',
        hide: VariableHide.hideVariable,
        value: undefined,
        placeholder: 'Select',
        isMulti: true,
      }),
    ],
  });
}

function getStyles(theme: GrafanaTheme2, chromeHeaderHeight: number) {
  return {
    container: css({
      flexGrow: 1,
      display: 'flex',
      gap: theme.spacing(1),
      flexDirection: 'column',
      background: theme.isLight ? theme.colors.background.primary : theme.colors.background.canvas,
      padding: theme.spacing(2, 3, 2, 3),
    }),
    body: css({
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
    }),
    controls: css({
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 0),
      alignItems: 'flex-end',
      flexWrap: 'wrap',
      position: 'sticky',
      background: theme.isDark ? theme.colors.background.canvas : theme.colors.background.primary,
      zIndex: theme.zIndex.navbarFixed,
      top: chromeHeaderHeight,
    }),
  };
}

function getBaseFiltersForMetric(metric?: string): AdHocVariableFilter[] {
  if (metric) {
    return [{ key: '__name__', operator: '=', value: metric }];
  }
  return [];
}
