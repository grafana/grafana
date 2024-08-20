import { css } from '@emotion/css';
import { useEffect } from 'react';

import { AdHocVariableFilter, GrafanaTheme2, PageLayoutType, RawTimeRange, VariableHide, urlUtil } from '@grafana/data';
import { locationService, useChromeHeaderHeight } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  ConstantVariable,
  CustomVariable,
  DataSourceVariable,
  getUrlSyncManager,
  SceneComponentProps,
  SceneControlsSpacer,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  sceneUtils,
  SceneVariable,
  SceneVariableSet,
  SceneVariableState,
  VariableDependencyConfig,
  VariableValueSelectors,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { DataTrailSettings } from './DataTrailSettings';
import { DataTrailHistory } from './DataTrailsHistory';
import { MetricScene } from './MetricScene';
import { MetricSelectScene } from './MetricSelect/MetricSelectScene';
import { MetricsHeader } from './MetricsHeader';
import { getTrailStore } from './TrailStore/TrailStore';
import { MetricDatasourceHelper } from './helpers/MetricDatasourceHelper';
import { reportChangeInLabelFilters } from './interactions';
import { getDeploymentEnvironments, getOtelResources, isOtelStandardization, totalOtelResources } from './otel/api';
import { OtelResourcesObject, OtelTargetType } from './otel/types';
import { sortResources } from './otel/util';
import {
  getVariablesWithOtelJoinQueryConstant,
  MetricSelectedEvent,
  trailDS,
  VAR_DATASOURCE,
  VAR_DATASOURCE_EXPR,
  VAR_FILTERS,
  VAR_OTEL_DEPLOYMENT_ENV,
  VAR_OTEL_JOIN_QUERY,
  VAR_OTEL_RESOURCES,
} from './shared';
import { getMetricName, getOtelJoinQuery, getOtelResourcesObject, getTrailFor } from './utils';

export interface DataTrailState extends SceneObjectState {
  topScene?: SceneObject;
  embedded?: boolean;
  controls: SceneObject[];
  history: DataTrailHistory;
  settings: DataTrailSettings;
  createdAt: number;

  // just for for the starting data source
  initialDS?: string;
  initialFilters?: AdHocVariableFilter[];

  // this is for otel, if the data source has it, it will be updated here
  hasOtelResources?: boolean;
  useOtelExperience?: boolean;
  otelTargets?: OtelTargetType; // all the targets with job and instance regex, job=~"<job-v>|<job-v>"", instance=~"<instance-v>|<instance-v>"
  otelResources?: string[];
  otelJoinQuery?: string;
  isStandardOtel?: boolean;

  // moved into settings
  showPreviews?: boolean;

  // Synced with url
  metric?: string;
  metricSearch?: string;
}

// NEXT WORK,
// - [x] filter for metrics that are related to otel resources
// - [x] refilter metrics, build layout on change of otel targets
// - [x] move the toggle into the settings
// - [x] default to otel experience on if DS has otel resources
// - [x] sort the labels by blessed list
// - [x] clear otel filters and otel join query on changing data source
// - [x] clear state checks like hasOtelResources when data source is changed
// - [ ] update the url by all the state
// - [ ] show the labels in the breakdown
// - [ ] test the limit of a match string when filtering metrics in MetricSelectScene

export class DataTrail extends SceneObjectBase<DataTrailState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['metric', 'metricSearch'] });

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
      // default to false but update this to true on checkOtelSandardization()
      // or true if the user either turned on the experience
      useOtelExperience: state.useOtelExperience ?? false,
      // preserve the otel join query
      otelJoinQuery: state.otelJoinQuery ?? '',
      showPreviews: true,
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

    // Save the current trail as a recent if the browser closes or reloads
    const saveRecentTrail = () => getTrailStore().setRecentTrail(this);
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
        // clear filters on resetting the data source
        const adhocVariable = sceneGraph.lookupVariable(VAR_FILTERS, this);
        if (adhocVariable instanceof AdHocFiltersVariable) {
          adhocVariable.setState({ filters: [] });
        }
      }

      // update otel variables when changed
      if (this.state.useOtelExperience && (name === VAR_OTEL_DEPLOYMENT_ENV || name === VAR_OTEL_RESOURCES)) {
        const resourcesObject: OtelResourcesObject = getOtelResourcesObject(this);
        const otelJoinQuery = getOtelJoinQuery(resourcesObject);

        this.setState({ otelJoinQuery });
        // update the otel join query variable too
        const otelJoinQueryVariable = sceneGraph.lookupVariable(VAR_OTEL_JOIN_QUERY, this);
        if (otelJoinQueryVariable instanceof ConstantVariable) {
          otelJoinQueryVariable.setState({ value: otelJoinQuery });
        }

        // update the targets used to filter metrics
        const timeRange: RawTimeRange | undefined = this.state.$timeRange?.state;
        const datasourceUid = sceneGraph.interpolate(this, VAR_DATASOURCE_EXPR);
        if (timeRange) {
          const otelTargets = await totalOtelResources(datasourceUid, timeRange, resourcesObject.filters);
          this.setState({ otelTargets });
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

    const urlState = getUrlSyncManager().getUrlState(this);
    const fullUrl = urlUtil.renderUrl(locationService.getLocation().pathname, urlState);
    locationService.replace(fullUrl);
  }

  private _handleMetricSelectedEvent(evt: MetricSelectedEvent) {
    this.setState(this.getSceneUpdatesForNewMetricValue(evt.payload));

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

  getUrlState() {
    const { metric, metricSearch } = this.state;
    return { metric, metricSearch };
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

    const otelResourcesVariable = sceneGraph.lookupVariable(VAR_OTEL_RESOURCES, this);
    const otelDepEnvVariable = sceneGraph.lookupVariable(VAR_OTEL_DEPLOYMENT_ENV, this);
    const otelJoinQueryVariable = sceneGraph.lookupVariable(VAR_OTEL_JOIN_QUERY, this);
    // get the time range
    const timeRange: RawTimeRange | undefined = trail.state.$timeRange?.state;

    if (
      timeRange &&
      otelResourcesVariable instanceof AdHocFiltersVariable &&
      otelDepEnvVariable instanceof CustomVariable &&
      otelJoinQueryVariable instanceof ConstantVariable
    ) {
      const datasourceUid = sceneGraph.interpolate(trail, VAR_DATASOURCE_EXPR);

      const otelTargets = await totalOtelResources(datasourceUid, timeRange);
      const deploymentEnvironments = await getDeploymentEnvironments(datasourceUid, timeRange);
      const hasOtelResources = otelTargets.job !== '' && otelTargets.instance !== '';
      const isStandard = await isOtelStandardization(datasourceUid, timeRange);

      if (hasOtelResources && isStandard && deploymentEnvironments.length > 0) {
        // get the labels for otel resources
        const excludedFilters = getOtelFilterKeys(otelResourcesVariable);
        let resources = await getOtelResources(datasourceUid, timeRange, excludedFilters);
        if (resources.length === 0) {
          return;
        }
        // make sure not to re-add filters from the blessed list
        resources = sortResources(resources, excludedFilters);

        // make the variable options
        const otelLabels = resources.map((resource) => {
          return { text: resource };
        });

        otelResourcesVariable?.setState({
          defaultKeys: otelLabels,
          hide: VariableHide.hideLabel,
        });

        let varQuery = '';
        const options = deploymentEnvironments.map((env) => {
          varQuery += env + ',';
          return { value: env, label: env };
        });

        otelDepEnvVariable?.setState({
          // cannot have an undefined custom value
          // this breaks everything
          // create an issue for this
          value: options[0].value,
          query: varQuery,
          options: options,
          hide: VariableHide.dontHide,
        });

        // Because we need to define the deployment environment variable
        // we also need to update the otel join query state and variable
        const resourcesObject: OtelResourcesObject = getOtelResourcesObject(this, options[0].value);
        const otelJoinQuery = getOtelJoinQuery(resourcesObject);
        this.setState({ otelJoinQuery });
        // update the otel join query variable too
        otelJoinQueryVariable.setState({ value: otelJoinQuery });

        // now we can filter target_info targets by deployment_environment="somevalue"
        // and use these new targets to reduce the metrics
        const filteredOtelTargets = await totalOtelResources(datasourceUid, timeRange, resourcesObject.filters);
        this.setState({
          hasOtelResources,
          isStandardOtel: isStandard && deploymentEnvironments.length > 0,
          otelTargets: filteredOtelTargets,
          otelResources: resources,
          useOtelExperience: true,
        });
      } else {
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

        this.setState({
          hasOtelResources,
          isStandardOtel: isStandard && deploymentEnvironments.length > 0,
          useOtelExperience: false,
          otelTargets: { job: '', instance: '' },
          otelResources: [],
          otelJoinQuery: '',
        });
      }
    }
  }

  static Component = ({ model }: SceneComponentProps<DataTrail>) => {
    const { controls, topScene, history, settings, metric, useOtelExperience, hasOtelResources } = model.useState();

    const chromeHeaderHeight = useChromeHeaderHeight();
    const styles = useStyles2(getStyles, chromeHeaderHeight ?? 0);
    const showHeaderForFirstTimeUsers = getTrailStore().recent.length < 2;

    useEffect(() => {
      // check if the otel experience has been enabled
      if (!useOtelExperience) {
        // if the experience has been turned off, reset the otel variables
        const otelResourcesVariable = sceneGraph.lookupVariable(VAR_OTEL_RESOURCES, model);
        const otelDepEnvVariable = sceneGraph.lookupVariable(VAR_OTEL_DEPLOYMENT_ENV, model);
        const otelJoinQueryVariable = sceneGraph.lookupVariable(VAR_OTEL_JOIN_QUERY, model);

        if (
          otelResourcesVariable instanceof AdHocFiltersVariable &&
          otelDepEnvVariable instanceof CustomVariable &&
          otelJoinQueryVariable instanceof ConstantVariable
        ) {
          otelResourcesVariable.setState({
            defaultKeys: [],
            hide: VariableHide.hideVariable,
          });

          otelDepEnvVariable.setState({
            value: '',
            hide: VariableHide.hideVariable,
          });

          otelJoinQueryVariable.setState({ value: '' });

          model.setState({
            otelTargets: { job: '', instance: '' },
            otelResources: [],
            otelJoinQuery: '',
          });
        }
      } else {
        // if experience is enabled, check standardization and update the otel variables
        model.checkDataSourceForOTelResources();
      }
    }, [model, hasOtelResources, useOtelExperience]);

    return (
      <Page navId="explore/metrics" pageNav={{ text: getMetricName(metric) }} layout={PageLayoutType.Custom}>
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
          <div className={styles.body}>{topScene && <topScene.Component model={topScene} />}</div>
        </div>
      </Page>
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
        includeAll: true,
        defaultToAll: false,
        noValueOnClear: true,
      }),
      new AdHocFiltersVariable({
        name: VAR_OTEL_RESOURCES,
        addFilterButtonText: 'Add OTel resources',
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
      }),
      ...getVariablesWithOtelJoinQueryConstant(otelJoinQuery ?? ''),
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

function getOtelFilterKeys(variable: SceneVariable<SceneVariableState> | null) {
  if (!variable) {
    return [];
  }

  let filterKeys: string[] = [];
  if (variable instanceof AdHocFiltersVariable) {
    filterKeys = variable?.state.filters.map((f) => f.key);
  }
  return filterKeys;
}
