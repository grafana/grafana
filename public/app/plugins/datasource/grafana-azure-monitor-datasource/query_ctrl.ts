import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
// import './css/query_editor.css';
import TimegrainConverter from './time_grain_converter';
import './editor/editor_component';

import { TemplateSrv } from 'app/features/templating/template_srv';
import { auto } from 'angular';
import { SeriesData } from '@grafana/ui';

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
      metricName: string;
      dimensionFilter: string;
      timeGrain: string;
      timeGrainUnit: string;
      timeGrains: any[];
      dimensions: any[];
      dimension: any;
      aggregation: string;
      aggOptions: string[];
    };
    azureLogAnalytics: {
      query: string;
      resultFormat: string;
      workspace: string;
    };
    appInsights: {
      metricName: string;
      rawQuery: boolean;
      rawQueryString: string;
      groupBy: string;
      timeGrainType: string;
      xaxis: string;
      yaxis: string;
      spliton: string;
      aggOptions: string[];
      aggregation: string;
      groupByOptions: string[];
      timeGrainUnit: string;
      timeGrain: string;
    };
  };

  defaults = {
    queryType: 'Azure Monitor',
    azureMonitor: {
      resourceGroup: this.defaultDropdownValue,
      metricDefinition: this.defaultDropdownValue,
      resourceName: this.defaultDropdownValue,
      metricName: this.defaultDropdownValue,
      dimensionFilter: '*',
      timeGrain: 'auto',
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
      groupBy: 'none',
      timeGrainType: 'auto',
      xaxis: 'timestamp',
      yaxis: '',
      spliton: '',
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

    this.panelCtrl.events.on('data-received', this.onDataReceived.bind(this), $scope);
    this.panelCtrl.events.on('data-error', this.onDataError.bind(this), $scope);
    this.resultFormats = [{ text: 'Time series', value: 'time_series' }, { text: 'Table', value: 'table' }];
    this.getSubscriptions();
    if (this.target.queryType === 'Azure Log Analytics') {
      this.getWorkspaces();
    }
  }

  onDataReceived(dataList: SeriesData[]) {
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
  }

  migrateToFromTimes() {
    this.target.azureLogAnalytics.query = this.target.azureLogAnalytics.query.replace(/\$__from\s/gi, '$__timeFrom() ');
    this.target.azureLogAnalytics.query = this.target.azureLogAnalytics.query.replace(/\$__to\s/gi, '$__timeTo() ');
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

  getMetricNames(query: any) {
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
      .getMetricNames(
        this.replace(this.target.subscription || this.datasource.azureMonitorDatasource.subscriptionId),
        this.replace(this.target.azureMonitor.resourceGroup),
        this.replace(this.target.azureMonitor.metricDefinition),
        this.replace(this.target.azureMonitor.resourceName)
      )
      .catch(this.handleQueryCtrlError.bind(this));
  }

  onResourceGroupChange() {
    this.target.azureMonitor.metricDefinition = this.defaultDropdownValue;
    this.target.azureMonitor.resourceName = this.defaultDropdownValue;
    this.target.azureMonitor.metricName = this.defaultDropdownValue;
    this.target.azureMonitor.aggregation = '';
    this.target.azureMonitor.timeGrains = [];
    this.target.azureMonitor.timeGrain = '';
    this.target.azureMonitor.dimensions = [];
    this.target.azureMonitor.dimension = '';
  }

  onMetricDefinitionChange() {
    this.target.azureMonitor.resourceName = this.defaultDropdownValue;
    this.target.azureMonitor.metricName = this.defaultDropdownValue;
    this.target.azureMonitor.aggregation = '';
    this.target.azureMonitor.timeGrains = [];
    this.target.azureMonitor.timeGrain = '';
    this.target.azureMonitor.dimensions = [];
    this.target.azureMonitor.dimension = '';
  }

  onResourceNameChange() {
    this.target.azureMonitor.metricName = this.defaultDropdownValue;
    this.target.azureMonitor.aggregation = '';
    this.target.azureMonitor.timeGrains = [];
    this.target.azureMonitor.timeGrain = '';
    this.target.azureMonitor.dimensions = [];
    this.target.azureMonitor.dimension = '';
  }

  onMetricNameChange() {
    if (!this.target.azureMonitor.metricName || this.target.azureMonitor.metricName === this.defaultDropdownValue) {
      return;
    }

    return this.datasource
      .getMetricMetadata(
        this.replace(this.target.subscription),
        this.replace(this.target.azureMonitor.resourceGroup),
        this.replace(this.target.azureMonitor.metricDefinition),
        this.replace(this.target.azureMonitor.resourceName),
        this.replace(this.target.azureMonitor.metricName)
      )
      .then((metadata: any) => {
        this.target.azureMonitor.aggOptions = metadata.supportedAggTypes || [metadata.primaryAggType];
        this.target.azureMonitor.aggregation = metadata.primaryAggType;
        this.target.azureMonitor.timeGrains = [{ text: 'auto', value: 'auto' }].concat(metadata.supportedTimeGrains);
        this.target.azureMonitor.timeGrain = 'auto';

        this.target.azureMonitor.dimensions = metadata.dimensions;
        if (metadata.dimensions.length > 0) {
          this.target.azureMonitor.dimension = metadata.dimensions[0].value;
        }
        return this.refresh();
      })
      .catch(this.handleQueryCtrlError.bind(this));
  }

  getAutoInterval() {
    if (this.target.azureMonitor.timeGrain === 'auto') {
      return TimegrainConverter.findClosestTimeGrain(
        this.templateSrv.getBuiltInIntervalValue(),
        _.map(this.target.azureMonitor.timeGrains, o =>
          TimegrainConverter.createKbnUnitFromISO8601Duration(o.value)
        ) || ['1m', '5m', '15m', '30m', '1h', '6h', '12h', '1d']
      );
    }

    return '';
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
        this.target.appInsights.groupByOptions = aggData.supportedGroupBy;
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
    return _.map(this.target.appInsights.groupByOptions, option => {
      return { text: option, value: option };
    });
  }

  resetAppInsightsGroupBy() {
    this.target.appInsights.groupBy = 'none';
    this.refresh();
  }

  updateTimeGrainType() {
    if (this.target.appInsights.timeGrainType === 'specific') {
      this.target.appInsights.timeGrain = '1';
      this.target.appInsights.timeGrainUnit = 'minute';
    } else {
      this.target.appInsights.timeGrain = '';
    }
    this.refresh();
  }

  toggleEditorMode() {
    this.target.appInsights.rawQuery = !this.target.appInsights.rawQuery;
  }
}
