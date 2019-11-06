import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
// import './css/query_editor.css';
import TimegrainConverter from './time_grain_converter';
import './editor/editor_component';
import kbn from 'app/core/utils/kbn';

import { TemplateSrv } from 'app/features/templating/template_srv';
import { auto, IPromise } from 'angular';
import { DataFrame } from '@grafana/data';
import { PanelEvents } from '@grafana/data';

export interface ResultFormat {
  text: string;
  value: string;
}

export class AzureMonitorQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  defaultDropdownValue = 'select';

  target: {
    refId: string;
    queryType: string;
    subscription: string;
    azureMonitor: {
      resourceGroup: string;
      resourceName: string;
      metricDefinition: string;
      metricNamespace: string;
      metricName: string;
      dimensionFilter: string;
      timeGrain: string;
      timeGrainUnit: string;
      allowedTimeGrainsMs: number[];
      dimensions: any[];
      dimension: any;
      top: string;
      aggregation: string;
      aggOptions: string[];
      timeGrains: Array<{ text: string; value: string }>;
    };
    azureLogAnalytics: {
      query: string;
      resultFormat: string;
      workspace: string;
    };
    appInsights: {
      rawQuery: boolean;
      // metric style query when rawQuery == false
      metricName: string;
      dimension: any;
      dimensionFilter: string;
      dimensions: string[];

      aggOptions: string[];
      aggregation: string;

      timeGrainType: string;
      timeGrainCount: string;
      timeGrainUnit: string;
      timeGrain: string;
      timeGrains: Array<{ text: string; value: string }>;
      allowedTimeGrainsMs: number[];

      // query style query when rawQuery == true
      rawQueryString: string;
      timeColumn: string;
      valueColumn: string;
      segmentColumn: string;
    };
  };

  defaults = {
    queryType: 'Azure Monitor',
    azureMonitor: {
      resourceGroup: this.defaultDropdownValue,
      metricDefinition: this.defaultDropdownValue,
      resourceName: this.defaultDropdownValue,
      metricNamespace: this.defaultDropdownValue,
      metricName: this.defaultDropdownValue,
      dimensionFilter: '*',
      timeGrain: 'auto',
      top: '10',
      aggOptions: [] as string[],
      timeGrains: [] as string[],
    },
    azureLogAnalytics: {
      query: [
        '//change this example to create your own time series query',
        '<table name>                                                              ' +
          '//the table to query (e.g. Usage, Heartbeat, Perf)',
        '| where $__timeFilter(TimeGenerated)                                      ' +
          '//this is a macro used to show the full chart’s time range, choose the datetime column here',
        '| summarize count() by <group by column>, bin(TimeGenerated, $__interval) ' +
          '//change “group by column” to a column in your table, such as “Computer”. ' +
          'The $__interval macro is used to auto-select the time grain. Can also use 1h, 5m etc.',
        '| order by TimeGenerated asc',
      ].join('\n'),
      resultFormat: 'time_series',
      workspace:
        this.datasource && this.datasource.azureLogAnalyticsDatasource
          ? this.datasource.azureLogAnalyticsDatasource.defaultOrFirstWorkspace
          : '',
    },
    appInsights: {
      metricName: this.defaultDropdownValue,
      rawQuery: false,
      rawQueryString: '',
      dimension: 'none',
      timeGrain: 'auto',
      timeColumn: 'timestamp',
      valueColumn: '',
    },
  };

  resultFormats: ResultFormat[];
  workspaces: any[];
  showHelp: boolean;
  showLastQuery: boolean;
  lastQuery: string;
  lastQueryError?: string;
  subscriptions: Array<{ text: string; value: string }>;

  /** @ngInject */
  constructor($scope: any, $injector: auto.IInjectorService, private templateSrv: TemplateSrv) {
    super($scope, $injector);

    _.defaultsDeep(this.target, this.defaults);

    this.migrateTimeGrains();

    this.migrateToFromTimes();

    this.migrateToDefaultNamespace();

    this.migrateApplicationInsightsKeys();

    this.panelCtrl.events.on(PanelEvents.dataReceived, this.onDataReceived.bind(this), $scope);
    this.panelCtrl.events.on(PanelEvents.dataError, this.onDataError.bind(this), $scope);
    this.resultFormats = [{ text: 'Time series', value: 'time_series' }, { text: 'Table', value: 'table' }];
    this.getSubscriptions();
    if (this.target.queryType === 'Azure Log Analytics') {
      this.getWorkspaces();
    }
  }

  onDataReceived(dataList: DataFrame[]) {
    this.lastQueryError = undefined;
    this.lastQuery = '';

    const anySeriesFromQuery: any = _.find(dataList, { refId: this.target.refId });
    if (anySeriesFromQuery && anySeriesFromQuery.meta) {
      this.lastQuery = anySeriesFromQuery.meta.query;
    }
  }

  onDataError(err: any) {
    this.handleQueryCtrlError(err);
  }

  handleQueryCtrlError(err: any) {
    if (err.query && err.query.refId && err.query.refId !== this.target.refId) {
      return;
    }

    if (err.error && err.error.data && err.error.data.error && err.error.data.error.innererror) {
      if (err.error.data.error.innererror.innererror) {
        this.lastQueryError = err.error.data.error.innererror.innererror.message;
      } else {
        this.lastQueryError = err.error.data.error.innererror.message;
      }
    } else if (err.error && err.error.data && err.error.data.error) {
      this.lastQueryError = err.error.data.error.message;
    } else if (err.error && err.error.data) {
      this.lastQueryError = err.error.data.message;
    } else if (err.data && err.data.error) {
      this.lastQueryError = err.data.error.message;
    } else if (err.data && err.data.message) {
      this.lastQueryError = err.data.message;
    } else {
      this.lastQueryError = err;
    }
  }

  migrateTimeGrains() {
    if (this.target.azureMonitor.timeGrainUnit) {
      if (this.target.azureMonitor.timeGrain !== 'auto') {
        this.target.azureMonitor.timeGrain = TimegrainConverter.createISO8601Duration(
          this.target.azureMonitor.timeGrain,
          this.target.azureMonitor.timeGrainUnit
        );
      }

      delete this.target.azureMonitor.timeGrainUnit;
      this.onMetricNameChange();
    }

    if (this.target.appInsights.timeGrainUnit) {
      if (this.target.appInsights.timeGrain !== 'auto') {
        if (this.target.appInsights.timeGrainCount) {
          this.target.appInsights.timeGrain = TimegrainConverter.createISO8601Duration(
            this.target.appInsights.timeGrainCount,
            this.target.appInsights.timeGrainUnit
          );
        } else {
          this.target.appInsights.timeGrainCount = this.target.appInsights.timeGrain;
          this.target.appInsights.timeGrain = TimegrainConverter.createISO8601Duration(
            this.target.appInsights.timeGrain,
            this.target.appInsights.timeGrainUnit
          );
        }
      }
    }

    if (
      this.target.azureMonitor.timeGrains &&
      this.target.azureMonitor.timeGrains.length > 0 &&
      (!this.target.azureMonitor.allowedTimeGrainsMs || this.target.azureMonitor.allowedTimeGrainsMs.length === 0)
    ) {
      this.target.azureMonitor.allowedTimeGrainsMs = this.convertTimeGrainsToMs(this.target.azureMonitor.timeGrains);
    }

    if (
      this.target.appInsights.timeGrains &&
      this.target.appInsights.timeGrains.length > 0 &&
      (!this.target.appInsights.allowedTimeGrainsMs || this.target.appInsights.allowedTimeGrainsMs.length === 0)
    ) {
      this.target.appInsights.allowedTimeGrainsMs = this.convertTimeGrainsToMs(this.target.appInsights.timeGrains);
    }
  }

  migrateToFromTimes() {
    this.target.azureLogAnalytics.query = this.target.azureLogAnalytics.query.replace(/\$__from\s/gi, '$__timeFrom() ');
    this.target.azureLogAnalytics.query = this.target.azureLogAnalytics.query.replace(/\$__to\s/gi, '$__timeTo() ');
  }

  async migrateToDefaultNamespace() {
    if (
      this.target.azureMonitor.metricNamespace &&
      this.target.azureMonitor.metricNamespace !== this.defaultDropdownValue &&
      this.target.azureMonitor.metricDefinition
    ) {
      return;
    }

    this.target.azureMonitor.metricNamespace = this.target.azureMonitor.metricDefinition;
  }

  migrateApplicationInsightsKeys(): void {
    const appInsights = this.target.appInsights as any;

    // Migrate old app insights data keys to match other datasources
    const mappings = {
      xaxis: 'timeColumn',
      yaxis: 'valueColumn',
      spliton: 'segmentColumn',
      groupBy: 'dimension',
      groupByOptions: 'dimensions',
      filter: 'dimensionFilter',
    } as { [old: string]: string };

    for (const old in mappings) {
      if (appInsights[old]) {
        appInsights[mappings[old]] = appInsights[old];
        delete appInsights[old];
      }
    }
  }

  replace(variable: string) {
    return this.templateSrv.replace(variable, this.panelCtrl.panel.scopedVars);
  }

  onQueryTypeChange() {
    if (this.target.queryType === 'Azure Log Analytics') {
      return this.getWorkspaces();
    }
  }

  getSubscriptions() {
    if (!this.datasource.azureMonitorDatasource.isConfigured()) {
      return;
    }

    return this.datasource.azureMonitorDatasource.getSubscriptions().then((subs: any) => {
      this.subscriptions = subs;
      if (!this.target.subscription && this.target.queryType === 'Azure Monitor') {
        this.target.subscription = this.datasource.azureMonitorDatasource.subscriptionId;
      } else if (!this.target.subscription && this.target.queryType === 'Azure Log Analytics') {
        this.target.subscription = this.datasource.azureLogAnalyticsDatasource.logAnalyticsSubscriptionId;
      }

      if (!this.target.subscription && this.subscriptions.length > 0) {
        this.target.subscription = this.subscriptions[0].value;
      }

      return this.subscriptions;
    });
  }

  onSubscriptionChange() {
    if (this.target.queryType === 'Azure Log Analytics') {
      return this.getWorkspaces();
    }

    if (this.target.queryType === 'Azure Monitor') {
      this.target.azureMonitor.resourceGroup = this.defaultDropdownValue;
      this.target.azureMonitor.metricDefinition = this.defaultDropdownValue;
      this.target.azureMonitor.resourceName = this.defaultDropdownValue;
      this.target.azureMonitor.metricName = this.defaultDropdownValue;
      this.target.azureMonitor.aggregation = '';
      this.target.azureMonitor.timeGrains = [];
      this.target.azureMonitor.timeGrain = '';
      this.target.azureMonitor.dimensions = [];
      this.target.azureMonitor.dimension = '';
    }
  }

  /* Azure Monitor Section */
  getResourceGroups(query: any) {
    if (this.target.queryType !== 'Azure Monitor' || !this.datasource.azureMonitorDatasource.isConfigured()) {
      return;
    }

    return this.datasource
      .getResourceGroups(
        this.replace(this.target.subscription || this.datasource.azureMonitorDatasource.subscriptionId)
      )
      .catch(this.handleQueryCtrlError.bind(this));
  }

  getMetricDefinitions(query: any) {
    if (
      this.target.queryType !== 'Azure Monitor' ||
      !this.target.azureMonitor.resourceGroup ||
      this.target.azureMonitor.resourceGroup === this.defaultDropdownValue
    ) {
      return;
    }
    return this.datasource
      .getMetricDefinitions(
        this.replace(this.target.subscription || this.datasource.azureMonitorDatasource.subscriptionId),
        this.replace(this.target.azureMonitor.resourceGroup)
      )
      .catch(this.handleQueryCtrlError.bind(this));
  }

  getResourceNames(query: any) {
    if (
      this.target.queryType !== 'Azure Monitor' ||
      !this.target.azureMonitor.resourceGroup ||
      this.target.azureMonitor.resourceGroup === this.defaultDropdownValue ||
      !this.target.azureMonitor.metricDefinition ||
      this.target.azureMonitor.metricDefinition === this.defaultDropdownValue
    ) {
      return;
    }

    return this.datasource
      .getResourceNames(
        this.replace(this.target.subscription || this.datasource.azureMonitorDatasource.subscriptionId),
        this.replace(this.target.azureMonitor.resourceGroup),
        this.replace(this.target.azureMonitor.metricDefinition)
      )
      .catch(this.handleQueryCtrlError.bind(this));
  }

  getMetricNamespaces() {
    if (
      this.target.queryType !== 'Azure Monitor' ||
      !this.target.azureMonitor.resourceGroup ||
      this.target.azureMonitor.resourceGroup === this.defaultDropdownValue ||
      !this.target.azureMonitor.metricDefinition ||
      this.target.azureMonitor.metricDefinition === this.defaultDropdownValue ||
      !this.target.azureMonitor.resourceName ||
      this.target.azureMonitor.resourceName === this.defaultDropdownValue
    ) {
      return;
    }

    return this.datasource
      .getMetricNamespaces(
        this.replace(this.target.subscription || this.datasource.azureMonitorDatasource.subscriptionId),
        this.replace(this.target.azureMonitor.resourceGroup),
        this.replace(this.target.azureMonitor.metricDefinition),
        this.replace(this.target.azureMonitor.resourceName)
      )
      .catch(this.handleQueryCtrlError.bind(this));
  }

  getMetricNames() {
    if (
      this.target.queryType !== 'Azure Monitor' ||
      !this.target.azureMonitor.resourceGroup ||
      this.target.azureMonitor.resourceGroup === this.defaultDropdownValue ||
      !this.target.azureMonitor.metricDefinition ||
      this.target.azureMonitor.metricDefinition === this.defaultDropdownValue ||
      !this.target.azureMonitor.resourceName ||
      this.target.azureMonitor.resourceName === this.defaultDropdownValue ||
      !this.target.azureMonitor.metricNamespace ||
      this.target.azureMonitor.metricNamespace === this.defaultDropdownValue
    ) {
      return;
    }

    return this.datasource
      .getMetricNames(
        this.replace(this.target.subscription || this.datasource.azureMonitorDatasource.subscriptionId),
        this.replace(this.target.azureMonitor.resourceGroup),
        this.replace(this.target.azureMonitor.metricDefinition),
        this.replace(this.target.azureMonitor.resourceName),
        this.replace(this.target.azureMonitor.metricNamespace)
      )
      .catch(this.handleQueryCtrlError.bind(this));
  }

  onResourceGroupChange() {
    this.target.azureMonitor.metricDefinition = this.defaultDropdownValue;
    this.target.azureMonitor.resourceName = this.defaultDropdownValue;
    this.target.azureMonitor.metricNamespace = this.defaultDropdownValue;
    this.target.azureMonitor.metricName = this.defaultDropdownValue;
    this.target.azureMonitor.aggregation = '';
    this.target.azureMonitor.timeGrains = [];
    this.target.azureMonitor.timeGrain = '';
    this.target.azureMonitor.dimensions = [];
    this.target.azureMonitor.dimension = '';
    this.refresh();
  }

  onMetricDefinitionChange() {
    this.target.azureMonitor.resourceName = this.defaultDropdownValue;
    this.target.azureMonitor.metricNamespace = this.defaultDropdownValue;
    this.target.azureMonitor.metricName = this.defaultDropdownValue;
    this.target.azureMonitor.aggregation = '';
    this.target.azureMonitor.timeGrains = [];
    this.target.azureMonitor.timeGrain = '';
    this.target.azureMonitor.dimensions = [];
    this.target.azureMonitor.dimension = '';
  }

  onResourceNameChange() {
    this.target.azureMonitor.metricNamespace = this.defaultDropdownValue;
    this.target.azureMonitor.metricName = this.defaultDropdownValue;
    this.target.azureMonitor.aggregation = '';
    this.target.azureMonitor.timeGrains = [];
    this.target.azureMonitor.timeGrain = '';
    this.target.azureMonitor.dimensions = [];
    this.target.azureMonitor.dimension = '';
    this.refresh();
  }

  onMetricNamespacesChange() {
    this.target.azureMonitor.metricName = this.defaultDropdownValue;
    this.target.azureMonitor.dimensions = [];
    this.target.azureMonitor.dimension = '';
  }

  onMetricNameChange(): IPromise<void> {
    if (!this.target.azureMonitor.metricName || this.target.azureMonitor.metricName === this.defaultDropdownValue) {
      return Promise.resolve();
    }

    return this.datasource
      .getMetricMetadata(
        this.replace(this.target.subscription),
        this.replace(this.target.azureMonitor.resourceGroup),
        this.replace(this.target.azureMonitor.metricDefinition),
        this.replace(this.target.azureMonitor.resourceName),
        this.replace(this.target.azureMonitor.metricNamespace),
        this.replace(this.target.azureMonitor.metricName)
      )
      .then((metadata: any) => {
        this.target.azureMonitor.aggOptions = metadata.supportedAggTypes || [metadata.primaryAggType];
        this.target.azureMonitor.aggregation = metadata.primaryAggType;
        this.target.azureMonitor.timeGrains = [{ text: 'auto', value: 'auto' }].concat(metadata.supportedTimeGrains);
        this.target.azureMonitor.timeGrain = 'auto';

        this.target.azureMonitor.allowedTimeGrainsMs = this.convertTimeGrainsToMs(metadata.supportedTimeGrains || []);

        this.target.azureMonitor.dimensions = metadata.dimensions;
        if (metadata.dimensions.length > 0) {
          this.target.azureMonitor.dimension = metadata.dimensions[0].value;
        }

        return this.refresh();
      })
      .catch(this.handleQueryCtrlError.bind(this));
  }

  convertTimeGrainsToMs(timeGrains: Array<{ text: string; value: string }>) {
    const allowedTimeGrainsMs: number[] = [];
    timeGrains.forEach((tg: any) => {
      if (tg.value !== 'auto') {
        allowedTimeGrainsMs.push(kbn.interval_to_ms(TimegrainConverter.createKbnUnitFromISO8601Duration(tg.value)));
      }
    });
    return allowedTimeGrainsMs;
  }

  generateAutoUnits(timeGrain: string, timeGrains: Array<{ value: string }>) {
    if (timeGrain === 'auto') {
      return TimegrainConverter.findClosestTimeGrain(
        this.templateSrv.getBuiltInIntervalValue(),
        _.map(timeGrains, o => TimegrainConverter.createKbnUnitFromISO8601Duration(o.value)) || [
          '1m',
          '5m',
          '15m',
          '30m',
          '1h',
          '6h',
          '12h',
          '1d',
        ]
      );
    }

    return '';
  }

  getAzureMonitorAutoInterval() {
    return this.generateAutoUnits(this.target.azureMonitor.timeGrain, this.target.azureMonitor.timeGrains);
  }

  getApplicationInsightAutoInterval() {
    return this.generateAutoUnits(this.target.appInsights.timeGrain, this.target.appInsights.timeGrains);
  }

  /* Azure Log Analytics */

  getWorkspaces = () => {
    return this.datasource.azureLogAnalyticsDatasource
      .getWorkspaces(this.target.subscription)
      .then((list: any[]) => {
        this.workspaces = list;
        if (list.length > 0 && !this.target.azureLogAnalytics.workspace) {
          this.target.azureLogAnalytics.workspace = list[0].value;
        }
      })
      .catch(this.handleQueryCtrlError.bind(this));
  };

  getAzureLogAnalyticsSchema = () => {
    return this.getWorkspaces()
      .then(() => {
        return this.datasource.azureLogAnalyticsDatasource.getSchema(this.target.azureLogAnalytics.workspace);
      })
      .catch(this.handleQueryCtrlError.bind(this));
  };

  onLogAnalyticsQueryChange = (nextQuery: string) => {
    this.target.azureLogAnalytics.query = nextQuery;
  };

  onLogAnalyticsQueryExecute = () => {
    this.panelCtrl.refresh();
  };

  get templateVariables() {
    return this.templateSrv.variables.map(t => '$' + t.name);
  }

  /* Application Insights Section */

  getAppInsightsAutoInterval() {
    const interval = this.templateSrv.getBuiltInIntervalValue();
    if (interval[interval.length - 1] === 's') {
      return '1m';
    }
    return interval;
  }

  getAppInsightsMetricNames() {
    if (!this.datasource.appInsightsDatasource.isConfigured()) {
      return;
    }

    return this.datasource.getAppInsightsMetricNames().catch(this.handleQueryCtrlError.bind(this));
  }

  getAppInsightsColumns() {
    return this.datasource.getAppInsightsColumns(this.target.refId);
  }

  onAppInsightsColumnChange() {
    return this.refresh();
  }

  onAppInsightsMetricNameChange() {
    if (!this.target.appInsights.metricName || this.target.appInsights.metricName === this.defaultDropdownValue) {
      return;
    }

    return this.datasource
      .getAppInsightsMetricMetadata(this.replace(this.target.appInsights.metricName))
      .then((aggData: { supportedAggTypes: string[]; supportedGroupBy: string[]; primaryAggType: string }) => {
        this.target.appInsights.aggOptions = aggData.supportedAggTypes;
        this.target.appInsights.dimensions = aggData.supportedGroupBy;
        this.target.appInsights.aggregation = aggData.primaryAggType;
        return this.refresh();
      })
      .catch(this.handleQueryCtrlError.bind(this));
  }

  onAppInsightsQueryChange = (nextQuery: string) => {
    this.target.appInsights.rawQueryString = nextQuery;
  };

  onAppInsightsQueryExecute = () => {
    return this.refresh();
  };

  getAppInsightsQuerySchema = () => {
    return this.datasource.appInsightsDatasource.getQuerySchema().catch(this.handleQueryCtrlError.bind(this));
  };

  getAppInsightsGroupBySegments(query: any) {
    return _.map(this.target.appInsights.dimensions, (option: string) => {
      return { text: option, value: option };
    });
  }

  resetAppInsightsGroupBy() {
    this.target.appInsights.dimension = 'none';
    this.refresh();
  }

  toggleEditorMode() {
    this.target.appInsights.rawQuery = !this.target.appInsights.rawQuery;
  }

  updateTimeGrainType() {
    if (this.target.appInsights.timeGrainType === 'specific') {
      this.target.appInsights.timeGrainCount = '1';
      this.target.appInsights.timeGrainUnit = 'minute';
      this.target.appInsights.timeGrain = TimegrainConverter.createISO8601Duration(
        this.target.appInsights.timeGrainCount,
        this.target.appInsights.timeGrainUnit
      );
    } else {
      this.target.appInsights.timeGrainCount = '';
      this.target.appInsights.timeGrainUnit = '';
    }
  }

  updateAppInsightsTimeGrain() {
    if (this.target.appInsights.timeGrainUnit && this.target.appInsights.timeGrainCount) {
      this.target.appInsights.timeGrain = TimegrainConverter.createISO8601Duration(
        this.target.appInsights.timeGrainCount,
        this.target.appInsights.timeGrainUnit
      );
    }
    this.refresh();
  }
}
