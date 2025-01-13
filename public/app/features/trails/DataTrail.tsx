import { css } from '@emotion/css';
import { useEffect } from 'react';

import {
  AdHocVariableFilter,
  GetTagResponse,
  GrafanaTheme2,
  MetricFindValue,
  RawTimeRange,
  urlUtil,
  VariableHide,
} from '@grafana/data';
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
import { MetricDatasourceHelper } from './helpers/MetricDatasourceHelper';
import { reportChangeInLabelFilters } from './interactions';
import { getDeploymentEnvironments, TARGET_INFO_FILTER, totalOtelResources } from './otel/api';
import { OtelResourcesObject, OtelTargetType } from './otel/types';
import {
  getOtelJoinQuery,
  getOtelResourcesObject,
  getProdOrDefaultOption,
  sortResources,
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
    variableNames: [VAR_DATASOURCE, VAR_OTEL_RESOURCES, VAR_OTEL_DEPLOYMENT_ENV, VAR_OTEL_JOIN_QUERY],
    onReferencedVariableValueChanged: async (variable: SceneVariable) => {
      const { name } = variable.state;

      if (name === VAR_DATASOURCE) {
        this.datasourceHelper.reset();

        // fresh check for otel experience
        this.checkDataSourceForOTelResources();
      }

      // update otel variables when changed
      if (this.state.useOtelExperience && (name === VAR_OTEL_DEPLOYMENT_ENV || name === VAR_OTEL_RESOURCES)) {
        // for state and variables
        const timeRange: RawTimeRange | undefined = this.state.$timeRange?.state;
        const datasourceUid = sceneGraph.interpolate(this, VAR_DATASOURCE_EXPR);
        const otelDepEnvVariable = sceneGraph.lookupVariable(VAR_OTEL_DEPLOYMENT_ENV, this);
        const otelResourcesVariable = sceneGraph.lookupVariable(VAR_OTEL_RESOURCES, this);
        const otelJoinQueryVariable = sceneGraph.lookupVariable(VAR_OTEL_JOIN_QUERY, this);

        if (
          timeRange &&
          otelResourcesVariable instanceof AdHocFiltersVariable &&
          otelJoinQueryVariable instanceof ConstantVariable &&
          otelDepEnvVariable instanceof CustomVariable
        ) {
          this.updateOtelData(
            datasourceUid,
            timeRange,
            otelDepEnvVariable,
            otelResourcesVariable,
            otelJoinQueryVariable
          );
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
    if (!(variable instanceof AdHocFiltersVariable)) {
      return;
    }

    this._addingFilterWithoutReportingInteraction = true;

    variable.setState({ filters: [...variable.state.filters, filter] });

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
   * deployment_environment (first filter), otelResources (filters), otelJoinQuery (used in the query)
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
      const otelResourcesVariable = sceneGraph.lookupVariable(VAR_OTEL_RESOURCES, this);
      const otelDepEnvVariable = sceneGraph.lookupVariable(VAR_OTEL_DEPLOYMENT_ENV, this);
      const otelJoinQueryVariable = sceneGraph.lookupVariable(VAR_OTEL_JOIN_QUERY, this);
      const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, this);

      const datasourceUid = sceneGraph.interpolate(trail, VAR_DATASOURCE_EXPR);

      const otelTargets = await totalOtelResources(datasourceUid, timeRange);
      const deploymentEnvironments = await getDeploymentEnvironments(datasourceUid, timeRange, getSelectedScopes());
      const hasOtelResources = otelTargets.jobs.length > 0 && otelTargets.instances.length > 0;
      if (
        otelResourcesVariable instanceof AdHocFiltersVariable &&
        otelDepEnvVariable instanceof CustomVariable &&
        otelJoinQueryVariable instanceof ConstantVariable &&
        filtersVariable instanceof AdHocFiltersVariable
      ) {
        // HERE WE START THE OTEL EXPERIENCE ENGINE
        // 1. Set deployment variable values
        // 2. update all other variables and state
        if (hasOtelResources && deploymentEnvironments.length > 0) {
          // apply VAR FILTERS manually
          // otherwise they will appear anywhere the query contains {} characters
          filtersVariable.setState({
            addFilterButtonText: 'Select metric attributes',
            label: 'Select metric attribute',
          });

          // 1. set deployment variable values
          let varQuery = '';
          const options = deploymentEnvironments.map((env) => {
            varQuery += env + ',';
            return { value: env, label: env };
          });
          // We have to have a default value because custom variable requires it
          // we choose one default value to help filter metrics
          // The work flow for OTel begins with users selecting a deployment environment
          // default to production
          let defaultDepEnv = getProdOrDefaultOption(options) ?? '';
          // On starting the explore metrics workflow, the custom variable has no value
          // Even if there is state, the value is always ''
          // The only reference to state values are in the text
          const otelDepEnvValue = otelDepEnvVariable.state.text;

          // TypeScript issue: VariableValue is either a string or array but does not have any string or array methods on it to check that it is empty
          const notInitialvalue = otelDepEnvValue !== '' && otelDepEnvValue.toLocaleString() !== '';

          const depEnvInitialValue = notInitialvalue ? otelDepEnvValue : defaultDepEnv;

          otelDepEnvVariable?.setState({
            value: depEnvInitialValue,
            options: options,
            hide: VariableHide.dontHide,
          });

          this.updateOtelData(
            datasourceUid,
            timeRange,
            otelDepEnvVariable,
            otelResourcesVariable,
            otelJoinQueryVariable,
            deploymentEnvironments,
            hasOtelResources
          );
        } else {
          // reset filters to apply auto, anywhere there are {} characters
          this.resetOtelExperience(
            otelResourcesVariable,
            otelDepEnvVariable,
            otelJoinQueryVariable,
            filtersVariable,
            hasOtelResources,
            deploymentEnvironments
          );
        }
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
   * @param otelDepEnvVariable
   * @param otelResourcesVariable
   * @param otelJoinQueryVariable
   * @param deploymentEnvironments
   * @param hasOtelResources
   */
  async updateOtelData(
    datasourceUid: string,
    timeRange: RawTimeRange,
    otelDepEnvVariable: CustomVariable,
    otelResourcesVariable: AdHocFiltersVariable,
    otelJoinQueryVariable: ConstantVariable,
    deploymentEnvironments?: string[],
    hasOtelResources?: boolean
  ) {
    // 1. Set the otelResources adhoc tagKey and tagValues filter functions
    // get the labels for otel resources
    // collection of filters for the otel resource variable
    // filter label names and label values
    // the first filter is {__name__="target_info"}
    let filters: AdHocVariableFilter[] = [TARGET_INFO_FILTER];

    // always start with the deployment environment
    const depEnvValue = '' + otelDepEnvVariable?.getValue();

    if (depEnvValue) {
      // update the operator if more than one
      const op = depEnvValue.includes(',') ? '=~' : '=';
      // the second filter is deployment_environment
      const filter = {
        key: 'deployment_environment',
        value: depEnvValue.split(',').join('|'),
        operator: op,
      };

      filters.push(filter);
    }
    // next we check the otel resources adhoc variable for filters
    const values = otelResourcesVariable.getValue();

    if (values && otelResourcesVariable.state.filters.length > 0) {
      filters = filters.concat(otelResourcesVariable.state.filters);
    }
    // the datasourceHelper will give us access to the
    // Prometheus functions getTagKeys and getTagValues
    // because we can access the ds
    const datasourceHelper = this.datasourceHelper;
    // now we reset the override tagKeys and tagValues functions of the adhoc variable
    otelResourcesVariable.setState({
      getTagKeysProvider: async (
        variable: AdHocFiltersVariable,
        currentKey: string | null
      ): Promise<{
        replace?: boolean;
        values: GetTagResponse | MetricFindValue[];
      }> => {
        // apply filters here
        // we're passing the queries so we get the labels that adhere to the queries
        // we're also passing the scopes so we get the labels that adhere to the scopes filters
        let values = await datasourceHelper.getTagKeys({
          filters,
          scopes: getSelectedScopes(),
          queries: this.getQueries(),
        });
        values = sortResources(values, filters.map((f) => f.key).concat(currentKey ?? ''));
        return { replace: true, values };
      },
      getTagValuesProvider: async (
        variable: AdHocFiltersVariable,
        filter: AdHocVariableFilter
      ): Promise<{
        replace?: boolean;
        values: GetTagResponse | MetricFindValue[];
      }> => {
        // apply filters here
        // remove current selected filter if refiltering
        filters = filters.filter((f) => f.key !== filter.key);
        // we're passing the queries so we get the label values that adhere to the queries
        // we're also passing the scopes so we get the label values that adhere to the scopes filters
        const values = await datasourceHelper.getTagValues({
          key: filter.key,
          filters,
          scopes: getSelectedScopes(),
          queries: this.getQueries(),
        });
        return { replace: true, values };
      },
      hide: VariableHide.hideLabel,
    });

    // 2. Get the otel join query for state and variable
    // Because we need to define the deployment environment variable
    // we also need to update the otel join query state and variable
    const resourcesObject: OtelResourcesObject = getOtelResourcesObject(this);
    const otelJoinQuery = getOtelJoinQuery(resourcesObject);

    // update the otel join query variable too
    otelJoinQueryVariable.setState({ value: otelJoinQuery });

    // 3. Update state with the following
    // - otel join query
    // - otelTargets used to filter metrics
    // now we can filter target_info targets by deployment_environment="somevalue"
    // and use these new targets to reduce the metrics
    // for initialization we also update the following
    // - has otel resources flag
    // - and default to useOtelExperience
    const otelTargets = await totalOtelResources(datasourceUid, timeRange, resourcesObject.filters);

    // we pass in deploymentEnvironments and hasOtelResources on start
    if (hasOtelResources && deploymentEnvironments) {
      const isEnabledInLocalStorage = getOtelExperienceToggleState();
      this.setState({
        otelTargets,
        otelJoinQuery,
        hasOtelResources,
        isStandardOtel: deploymentEnvironments.length > 0,
        useOtelExperience: isEnabledInLocalStorage,
      });
    } else {
      // we are updating on variable changes
      this.setState({
        otelTargets,
        otelJoinQuery,
      });
    }
  }

  resetOtelExperience(
    otelResourcesVariable: AdHocFiltersVariable,
    otelDepEnvVariable: CustomVariable,
    otelJoinQueryVariable: ConstantVariable,
    filtersVariable: AdHocFiltersVariable,
    hasOtelResources?: boolean,
    deploymentEnvironments?: string[]
  ) {
    // reset filters to apply auto, anywhere there are {} characters
    filtersVariable.setState({
      addFilterButtonText: 'Add label',
      label: 'Select label',
    });

    // if there are no resources reset the otel variables and otel state
    // or if not standard
    otelResourcesVariable.setState({
      defaultKeys: [],
      hide: VariableHide.hideVariable,
    });

    otelDepEnvVariable.setState({
      value: '',
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
    const { controls, topScene, history, settings, useOtelExperience, hasOtelResources, embedded } = model.useState();

    const chromeHeaderHeight = useChromeHeaderHeight();
    const styles = useStyles2(getStyles, embedded ? 0 : (chromeHeaderHeight ?? 0));
    const showHeaderForFirstTimeUsers = getTrailStore().recent.length < 2;

    useEffect(() => {
      // check if the otel experience has been enabled
      if (!useOtelExperience) {
        // if the experience has been turned off, reset the otel variables
        const otelResourcesVariable = sceneGraph.lookupVariable(VAR_OTEL_RESOURCES, model);
        const otelDepEnvVariable = sceneGraph.lookupVariable(VAR_OTEL_DEPLOYMENT_ENV, model);
        const otelJoinQueryVariable = sceneGraph.lookupVariable(VAR_OTEL_JOIN_QUERY, model);
        const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, model);

        if (
          otelResourcesVariable instanceof AdHocFiltersVariable &&
          otelDepEnvVariable instanceof CustomVariable &&
          otelJoinQueryVariable instanceof ConstantVariable &&
          filtersVariable instanceof AdHocFiltersVariable
        ) {
          model.resetOtelExperience(otelResourcesVariable, otelDepEnvVariable, otelJoinQueryVariable, filtersVariable);
        }
      } else {
        // if experience is enabled, check standardization and update the otel variables
        model.checkDataSourceForOTelResources();
      }
    }, [model, hasOtelResources, useOtelExperience]);

    useEffect(() => {
      const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, model);
      const datasourceHelper = model.datasourceHelper;
      limitAdhocProviders(model, filtersVariable, datasourceHelper);
    }, [model]);

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
      new CustomVariable({
        name: VAR_OTEL_DEPLOYMENT_ENV,
        label: 'Deployment environment',
        hide: VariableHide.hideVariable,
        value: undefined,
        placeholder: 'Select',
        isMulti: true,
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
        hide: VariableHide.hideLabel,
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
