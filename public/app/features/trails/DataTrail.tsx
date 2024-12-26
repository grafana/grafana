import { css } from '@emotion/css';
import { useEffect } from 'react';

import { AdHocVariableFilter, GrafanaTheme2, RawTimeRange, urlUtil, VariableHide } from '@grafana/data';
import { PromQuery } from '@grafana/prometheus';
import { locationService, useChromeHeaderHeight } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  ConstantVariable,
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
import { MetricDatasourceHelper } from './helpers/MetricDatasourceHelper';
import { reportChangeInLabelFilters } from './interactions';
import { getDeploymentEnvironments, getNonPromotedOtelResources, totalOtelResources } from './otel/api';
import { OtelResourcesObject, OtelTargetType } from './otel/types';
import {
  getOtelJoinQuery,
  getOtelResourcesObject,
  getProdOrDefaultOption,
  updateOtelJoinWithGroupLeft,
} from './otel/util';
import { getOtelExperienceToggleState } from './services/store';
import {
  getVariablesWithOtelJoinQueryConstant,
  MetricSelectedEvent,
  trailDS,
  VAR_DATASOURCE,
  VAR_DATASOURCE_EXPR,
  VAR_FILTERS,
  VAR_MISSING_OTEL_TARGETS,
  VAR_OTEL_AND_METRIC_FILTERS,
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
  initialCheckComplete?: boolean; // updated after the first otel check
  fromStart?: boolean; // 

  // moved into settings
  showPreviews?: boolean;

  // Synced with url
  metric?: string;
  metricSearch?: string;
}

export class DataTrail extends SceneObjectBase<DataTrailState> implements SceneObjectWithUrlSync {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['metric', 'metricSearch', 'showPreviews'] });

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
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  public _onActivate() {
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
          // we know it is the initial check because the label is hidden
          // the initial check may also be the data source resetting!
          const isNormalUpdate = newState.hide === prevState.hide;
          if (this.state.useOtelExperience && isNormalUpdate) {
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

        // fresh check for otel experience
        this.checkDataSourceForOTelResources(true);
      }

      // update otel variables when changed
      if (this.state.useOtelExperience && name === VAR_OTEL_RESOURCES) {
        // for state and variables
        const timeRange: RawTimeRange | undefined = this.state.$timeRange?.state;
        const datasourceUid = sceneGraph.interpolate(this, VAR_DATASOURCE_EXPR);
        if (timeRange) {

          this.updateOtelData(datasourceUid, timeRange);
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
    if (!(variable instanceof AdHocFiltersVariable) || !(otelAndMetricsFiltersVariable instanceof AdHocFiltersVariable)) {
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

    this.setState(this.getSceneUpdatesForNewMetricValue(metric));

    // Add metric to adhoc filters baseFilter
    const filterVar = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (filterVar instanceof AdHocFiltersVariable) {
      filterVar.setState({
        baseFilters: getBaseFiltersForMetric(evt.payload),
      });
    }
  }

  private getSceneUpdatesForNewMetricValue(metric: string | undefined) {
    const stateUpdate: Partial<DataTrailState> = {};
    stateUpdate.metric = metric;
    stateUpdate.topScene = getTopSceneFor(metric);
    return stateUpdate;
  }

  getUrlState(): SceneObjectUrlValues {
    const { metric, metricSearch, showPreviews } = this.state;
    return {
      metric,
      metricSearch,
      ...{ showPreviews: showPreviews === false ? 'false' : null },
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<DataTrailState> = {};

    if (typeof values.metric === 'string') {
      if (this.state.metric !== values.metric) {
        Object.assign(stateUpdate, this.getSceneUpdatesForNewMetricValue(values.metric));
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
  public async checkDataSourceForOTelResources(fromDataSourceChanged?: boolean) {
    // call up in to the parent trail
    const trail = getTrailFor(this);

    // get the time range
    const timeRange: RawTimeRange | undefined = trail.state.$timeRange?.state;

    if (timeRange) {
      const datasourceUid = sceneGraph.interpolate(trail, VAR_DATASOURCE_EXPR);
      const otelTargets = await totalOtelResources(datasourceUid, timeRange);
      const deploymentEnvironments = await getDeploymentEnvironments(datasourceUid, timeRange, getSelectedScopes());
      const hasOtelResources = otelTargets.jobs.length > 0 && otelTargets.instances.length > 0;
      // get the non promoted resources
      // THIS COULD BE THE FULL CHECK
      //   - remove hasOtelResources
      //   - remove deployment environments as a check
      const nonPromotedOtelResources = await getNonPromotedOtelResources(datasourceUid, timeRange);
      // HERE WE START THE OTEL EXPERIENCE ENGINE
      // 1. Set deployment variable values
      // 2. update all other variables and state
      if (hasOtelResources && nonPromotedOtelResources) {
        this.updateOtelData(
          datasourceUid,
          timeRange,
          deploymentEnvironments,
          hasOtelResources,
          nonPromotedOtelResources,
          fromDataSourceChanged
        );
      } else {
        // reset filters to apply auto, anywhere there are {} characters
        this.resetOtelExperience(hasOtelResources, deploymentEnvironments);
      }
    }
  }

  /**
   *  This function is used to update state and otel variables.
   *
   *  1. Set the otelResources adhoc tagKey and tagValues filter functions
   *  2. Get the otel join query for state and variable
   *  3. Update state with the following
   *    - otel join query
   *    - otelTargets used to filter metrics
   *  For initialization we also update the following
   *    - has otel resources flag
   *    - isStandardOtel flag (for enabliing the otel experience toggle)
   *    - and useOtelExperience
   *
   * This function is called on start and when variables change.
   * On start will provide the deploymentEnvironments and hasOtelResources parameters.
   * In the variable change case, we will not provide these parameters. It is assumed that the
   * data source has been checked for otel resources and standardization and the otel variables are enabled at this point.
   * @param datasourceUid
   * @param timeRange
   * @param deploymentEnvironments
   * @param hasOtelResources
   * @param nonPromotedOtelResources
   * @param fromDataSourceChanged
   */
  async updateOtelData(
    datasourceUid: string,
    timeRange: RawTimeRange,
    deploymentEnvironments?: string[],
    hasOtelResources?: boolean,
    nonPromotedOtelResources?: string[],
    fromDataSourceChanged?: boolean
  ) {
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
    // 1. set deployment variable as a new otel metric filter
    let varQuery = '';
    // do we need to create the options? probably not
    const options =
      deploymentEnvironments?.map((env) => {
        varQuery += env + ',';
        return { value: env, label: env };
      }) ?? [];
    // We have to have a default value because custom variable requires it
    // we choose one default value to help filter metrics
    // The work flow for OTel begins with users selecting a deployment environment
    // default to production
    let defaultDepEnv = getProdOrDefaultOption(options) ?? '';

    // 1. Cases of how to add filters to the otelmetricsvar
    //  -- when we set these on instanciation, we need to check that we are not double setting them
    // 1.0. legacy, check url values for dep env and otel resources and migrate to otelmetricvar
    //  -- do not duplicate
    // 1.1. NONE If the otel metrics var has no filters, set the default value
    // 1.2. VAR_FILTERS If the var filters has filters, add to otemetricsvar
    //  -- do not duplicate when adding to otelmtricsvar
    // 1.3. OTEL_FILTERS If the otel resources var has filters, add to otelmetricsvar
    //  -- do not duplicate when adding to otelmtricsvar

    // CHECK THE URL VALUES FOR PREVIOUS DEPLOYMENT ENVIRONMENT VALUES
    // and check the previous otel metric filters var for dep env
    // when data source is changed, clear out the deployment environment
    const depEnvFromOtelMetricVarFilters = fromDataSourceChanged
      ? []
      : otelAndMetricsFiltersVariable.state.filters.filter((f) => f.key === 'deployment_environment');
    // THERE ARE RACE CONDITIONS!!!!
    // set up the datasource - when the ds is not set up we automatically get !useOtelExperience
    // UPDATE ALL THREE VARS HERE WHEN IT IS THE FIRST CHECK
    // the subscription listener is disabled when we check if the label starts out as hidden and switches to hideLabel (show)
    // OPS CORTEX IS BEHAVING WEIRDLY, CHECKING OTEL RESOURCES TOO MUCH
    const isEnabledInLocalStorage = getOtelExperienceToggleState();

    // only update the variable state and hide if the otel experience is enabled
    if (!isEnabledInLocalStorage) {
      // show the var filters normally
      filtersVariable.setState({
        addFilterButtonText: 'Add label',
        label: 'Select label',
        hide: VariableHide.hideLabel,
      });
    } else {
      // 1. switching data source
      // THE PREVIOUS VAR FILTERS ARE NOT RESET SO EVEN IF THEY DON'T APPLY TO THE NEW DATA SOURCE WE WANT TO KEEP THEM
      // double check this in testing!!!
      // 2. on load with url values, check isInitial CheckComplete
      // Set otelmetrics var, distinguish if these are var filters or otel resources, then place in correct filter
      let prevVarFilters = this.state.initialCheckComplete ? filtersVariable.state.filters : []; 
      // only look at url values for otelmetricsvar if the initial check is NOT YET complete
      const urlOtelAndMetricsFilters = this.state.initialCheckComplete ? [] : otelAndMetricsFiltersVariable.state.filters;
      // url vars should overrid the deployment environment variable
      const urlVarsObject = checkLabelPromotion(urlOtelAndMetricsFilters, nonPromotedOtelResources);
      const urlOtelResources = this.state.initialCheckComplete ? [] : urlVarsObject.nonPromoted;
      const urlVarFilters = this.state.initialCheckComplete ? [] : urlVarsObject.promoted;
      // CHECK URL FOR THIS CONDITION TOO
      if (fromDataSourceChanged && depEnvFromOtelMetricVarFilters.length === 0) {
        // if the default dep env value like 'prod' is missing OR
        // if we are loading from the url and the default dep env is missing
        // there are no prev deployment environments from url
        // HOW DO WE DISTINGUISH BETWEEN A INITIAL AND A URL LOAD TO SEE
        // MAYBE THEY REMOVED THE DEP ENV?
        const hasUrlDepEnv = urlOtelAndMetricsFilters.filter((f) => f.key === 'deployment_environment').length > 0;
        const doNotSetDepEvValue = defaultDepEnv === '' || (!this.state.initialCheckComplete && (hasUrlDepEnv || !this.state.fromStart));
        // we do not have to set the dep env value if the default is missing
        const defaultDepEnvFilter = doNotSetDepEvValue
          ? []
          : [
              {
                key: 'deployment_environment',
                value: defaultDepEnv,
                operator: defaultDepEnv.includes(',') ? '=~' : '=',
              },
            ];
        
        const notPromoted = nonPromotedOtelResources?.includes('deployment_environment');
        // Next, the previous data source filters may include the default dep env but in the wrong filter
        // i.e., dep env is not promoted to metrics but in the previous DS, it was, so it will exist in the VAR FILTERS
        // and we will see a duplication in the OTELMETRICSVAR
        // remove the duplication
        prevVarFilters = notPromoted
          ? prevVarFilters.filter((f) => f.key !== 'deployment_environment')
          : prevVarFilters;
        
        // previous var filters are handled but what about previous otel resources filters?
        // need to add the prev otel resources to the otelmetricsvar filters
        // in the following cases
        // on load with url values
        // how do we distinguish between switching data sources and the initial check with possible load from url values
        otelAndMetricsFiltersVariable?.setState({
          filters: [...defaultDepEnvFilter, ...prevVarFilters, ...urlOtelAndMetricsFilters],
          hide: VariableHide.hideLabel,
        });

        // update the otel resources if the dep env has not been promoted
        const otelDepEnvFilters = notPromoted ? defaultDepEnvFilter : [];
        const otelFilters = [...otelDepEnvFilters, ...urlOtelResources];
        otelResourcesVariable.setState({
          filters: otelFilters,
          hide: VariableHide.hideVariable,
        });

        const isPromoted = !notPromoted;
        // if the dep env IS PROMOTED
        // does var filters already contain it?
        // keep previous filters if they are there
        // add the dep env to var filters if not present and isPromoted
        const depEnvFromVarFilters = prevVarFilters.filter((f) => f.key === 'deployment_environment');

        // if promoted and no dep env has been chosen yet, set the default
        if (isPromoted && depEnvFromVarFilters.length === 0) {
          prevVarFilters = [...prevVarFilters, ...defaultDepEnvFilter];
        }

        prevVarFilters = [...prevVarFilters, ...urlVarFilters];

        filtersVariable.setState({
          filters: prevVarFilters,
          hide: VariableHide.hideVariable,
        });
      }
    }
    // 1. Get the otel join query for state and variable
    // Because we need to define the deployment environment variable
    // we also need to update the otel join query state and variable
    const resourcesObject: OtelResourcesObject = getOtelResourcesObject(this);
    // THIS ASSUMES THAT WE ALWAYS HAVE DEPLOYMENT ENVIRONMENT!
    // FIX THIS SO THAT WE HAVE SOME QUERY EVEN IF THERE ARE NO OTEL FILTERS
    const otelJoinQuery = getOtelJoinQuery(resourcesObject);

    // update the otel join query variable too
    otelJoinQueryVariable.setState({ value: otelJoinQuery });

    // 2. Update state with the following
    // - otel join query
    // - otelTargets used to filter metrics
    // now we can filter target_info targets by deployment_environment="somevalue"
    // and use these new targets to reduce the metrics
    // for initialization we also update the following
    // - has otel resources flag
    // - and default to useOtelExperience
    const otelTargets = await totalOtelResources(datasourceUid, timeRange, resourcesObject.filters);

    // we pass in deploymentEnvironments and hasOtelResources on start
    // RETHINK We may be able to get rid of this check
    // a non standard data source is more missing job and instance matchers
    if (hasOtelResources && deploymentEnvironments) {
      this.setState({
        otelTargets,
        otelJoinQuery,
        hasOtelResources,
        // Previously checking standardization for having deployment environments
        // Now we check that there are target_info labels that are not promoted
        isStandardOtel: (nonPromotedOtelResources ?? []).length > 0,
        useOtelExperience: isEnabledInLocalStorage,
        nonPromotedOtelResources,
        initialCheckComplete: true,
      });
    } else {
      // we are updating on variable changes
      this.setState({
        otelTargets,
        otelJoinQuery,
      });
    }
  }

  resetOtelExperience(hasOtelResources?: boolean, deploymentEnvironments?: string[]) {
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
    // Resetting the otel experience filters means clearing both the otel resources var and the otemmetricsvar
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

    // full reset when a data source fails the check
    if (hasOtelResources && deploymentEnvironments) {
      this.setState({
        hasOtelResources,
        isStandardOtel: deploymentEnvironments.length > 0,
        useOtelExperience: false,
        otelTargets: { jobs: [], instances: [] },
        otelJoinQuery: '',
      });
    } else {
      // partial reset when a user turns off the otel experience
      this.setState({
        otelTargets: { jobs: [], instances: [] },
        otelJoinQuery: '',
        useOtelExperience: false,
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
    const { controls, topScene, history, settings, useOtelExperience, hasOtelResources } = model.useState();

    const chromeHeaderHeight = useChromeHeaderHeight();
    const styles = useStyles2(getStyles, chromeHeaderHeight ?? 0);
    const showHeaderForFirstTimeUsers = getTrailStore().recent.length < 2;

    useEffect(() => {
      // do not check otel until the data source is loaded
      if (model.datasourceHelper._metricsMetadata === undefined) {
        return;
      }
      // check if the otel experience has been enabled
      if (!useOtelExperience) {
        // if the experience has been turned off, reset the otel variables
        const otelResourcesVariable = sceneGraph.lookupVariable(VAR_OTEL_RESOURCES, model);
        const otelAndMetricsFiltersVariable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, model);
        const otelJoinQueryVariable = sceneGraph.lookupVariable(VAR_OTEL_JOIN_QUERY, model);
        const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, model);

        if (
          otelResourcesVariable instanceof AdHocFiltersVariable &&
          otelAndMetricsFiltersVariable instanceof AdHocFiltersVariable &&
          otelJoinQueryVariable instanceof ConstantVariable &&
          filtersVariable instanceof AdHocFiltersVariable
        ) {
          model.resetOtelExperience();
        }
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

    return (
      <div className={styles.container}>
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

export function getTopSceneFor(metric?: string) {
  if (metric) {
    return new MetricScene({ metric: metric });
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
        layout: 'vertical',
        defaultKeys: [],
        applyMode: 'manual',
      }),
      new AdHocFiltersVariable({
        name: VAR_FILTERS,
        addFilterButtonText: 'Add label',
        datasource: trailDS,
        // hide the variable on start because the otel check can make it look flickering,
        // switching from "labels" to "attributes"
        // show it only after passing or failing the otel check
        hide: VariableHide.hideVariable,
        layout: 'vertical',
        filters: initialFilters ?? [],
        baseFilters: getBaseFiltersForMetric(metric),
        applyMode: 'manual',
        // since we only support prometheus datasources, this is always true
        supportsMultiValueOperators: true,
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
        addFilterButtonText: 'Add attribute',
        datasource: trailDS,
        hide: VariableHide.hideVariable,
        layout: 'vertical',
        filters: initialFilters ?? [],
        baseFilters: getBaseFiltersForMetric(metric),
        applyMode: 'manual',
        // since we only support prometheus datasources, this is always true
        supportsMultiValueOperators: true,
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

/**
 * When a new filter is chosen from the consolidated filters, VAR_OTEL_AND_METRIC_FILTERS,
 * we need to identify the following:
 *
 * 1. Is the filter a non-promoted otel resource or a metric filter?
 * 2. Is the filter being added or removed?
 *
 * Once we know this, we can add the selected filter to either the
 * VAR_OTEL_RESOURCES or VAR_FILTERS variable.
 *
 * When the correct variable is updated, the rest of the explore metrics behavior will remain the same.
 *
 * @param newStateFilters
 * @param prevStateFilters
 * @param nonPromotedOtelResources
 * @param otelFiltersVariable
 * @param filtersVariable
 */
function manageOtelAndMetricFilters(
  newStateFilters: AdHocVariableFilter[],
  prevStateFilters: AdHocVariableFilter[],
  nonPromotedOtelResources: string[],
  otelFiltersVariable: AdHocFiltersVariable,
  filtersVariable: AdHocFiltersVariable
) {
  // add filter
  if (newStateFilters.length > prevStateFilters.length) {
    const newFilter = newStateFilters[newStateFilters.length - 1];
    // check that the filter is a non-promoted otel resource
    if (nonPromotedOtelResources?.includes(newFilter.key)) {
      // add to otel filters
      otelFiltersVariable.setState({
        filters: [...otelFiltersVariable.state.filters, newFilter],
      });
    } else {
      // add to metric filters
      filtersVariable.setState({
        filters: [...filtersVariable.state.filters, newFilter],
      });
    }
    return;
  }
  // remove filter
  if (newStateFilters.length < prevStateFilters.length) {
    // get the removed filter
    const removedFilter = prevStateFilters.filter((f) => !newStateFilters.includes(f))[0];
    if (nonPromotedOtelResources?.includes(removedFilter.key)) {
      // remove from otel filters
      otelFiltersVariable.setState({
        filters: otelFiltersVariable.state.filters.filter((f) => f.key !== removedFilter.key),
      });
    } else {
      // remove from metric filters
      filtersVariable.setState({
        filters: filtersVariable.state.filters.filter((f) => f.key !== removedFilter.key),
      });
    }
    return;
  }
  // a filter has been changed
  let updatedFilter: AdHocVariableFilter[] = [];
  if (
    newStateFilters.length === prevStateFilters.length &&
    newStateFilters.some((filter, i) => {
      const newKey = filter.key;
      const newValue = filter.value;
      const isUpdatedFilter = prevStateFilters[i].key === newKey && prevStateFilters[i].value !== newValue;
      if (isUpdatedFilter) {
        updatedFilter.push(filter);
      }
      return isUpdatedFilter;
    })
  ) {
    // check if the filter is a non-promoted otel resource
    if (nonPromotedOtelResources?.includes(updatedFilter[0].key)) {
      // add to otel filters
      otelFiltersVariable.setState({
        // replace the updated filter
        filters: otelFiltersVariable.state.filters.map((f) => {
          if (f.key === updatedFilter[0].key) {
            return updatedFilter[0];
          }
          return f;
        }),
      });
    } else {
      // add to metric filters
      filtersVariable.setState({
        // replace the updated filter
        filters: filtersVariable.state.filters.map((f) => {
          if (f.key === updatedFilter[0].key) {
            return updatedFilter[0];
          }
          return f;
        }),
      });
    }
  }
}

function checkLabelPromotion(filters: AdHocVariableFilter[], nonPromotedOtelResources: string[] = []) {
  const nonPromoted = filters.filter((f) => nonPromotedOtelResources.includes(f.key));
  const promoted = filters.filter((f) => !nonPromotedOtelResources.includes(f.key));
  
  return { 
    nonPromoted,
    promoted
  };
}
