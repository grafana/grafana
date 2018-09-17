import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
import appEvents from 'app/core/app_events';
import * as options from './constants';
// mport BaseComponent, * as extras from './A';

export interface QueryMeta {
  rawQuery: string;
  rawQueryString: string;
  metricLabels: { [key: string]: string[] };
  resourceLabels: { [key: string]: string[] };
}

export class StackdriverQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';
  target: {
    project: {
      id: string;
      name: string;
    };
    metricType: string;
    refId: string;
    aggregation: {
      crossSeriesReducer: string;
      secondaryCrossSeriesReducer: string;
      alignmentPeriod: string;
      perSeriesAligner: string;
      groupBys: string[];
    };
    filters: string[];
  };
  defaultDropdownValue = 'select metric';
  defaultFilterValue = 'select value';
  defaultRemoveGroupByValue = '-- remove group by --';
  defaultRemoveFilterValue = '-- remove filter --';
  loadLabelsPromise: Promise<any>;
  stackdriverConstants;

  defaults = {
    project: {
      id: 'default',
      name: 'loading project...',
    },
    metricType: this.defaultDropdownValue,
    aggregation: {
      crossSeriesReducer: 'REDUCE_MEAN',
      secondaryCrossSeriesReducer: 'REDUCE_NONE',
      alignmentPeriod: 'auto',
      perSeriesAligner: 'ALIGN_MEAN',
      groupBys: [],
    },
    filters: [],
    showAggregationOptions: false,
  };

  groupBySegments: any[];
  filterSegments: any[];
  removeSegment: any;
  showHelp: boolean;
  showLastQuery: boolean;
  lastQueryMeta: QueryMeta;
  lastQueryError?: string;
  metricLabels: { [key: string]: string[] };
  resourceLabels: { [key: string]: string[] };

  /** @ngInject */
  constructor($scope, $injector, private uiSegmentSrv, private timeSrv) {
    super($scope, $injector);
    _.defaultsDeep(this.target, this.defaults);

    this.panelCtrl.events.on('data-received', this.onDataReceived.bind(this), $scope);
    this.panelCtrl.events.on('data-error', this.onDataError.bind(this), $scope);
    this.stackdriverConstants = options;

    this.getCurrentProject()
      .then(this.getMetricTypes.bind(this))
      .then(this.getLabels.bind(this));

    this.initSegments();
  }

  initSegments() {
    this.groupBySegments = this.target.aggregation.groupBys.map(groupBy => {
      return this.uiSegmentSrv.getSegmentForValue(groupBy);
    });
    this.removeSegment = this.uiSegmentSrv.newSegment({ fake: true, value: '-- remove group by --' });
    this.ensurePlusButton(this.groupBySegments);

    this.filterSegments = [];
    this.target.filters.forEach((f, index) => {
      switch (index % 4) {
        case 0:
          this.filterSegments.push(this.uiSegmentSrv.newKey(f));
          break;
        case 1:
          this.filterSegments.push(this.uiSegmentSrv.newOperator(f));
          break;
        case 2:
          this.filterSegments.push(this.uiSegmentSrv.newKeyValue(f));
          break;
        case 3:
          this.filterSegments.push(this.uiSegmentSrv.newCondition(f));
          break;
      }
    });
    this.ensurePlusButton(this.filterSegments);
  }

  async getCurrentProject() {
    try {
      const projects = await this.datasource.getProjects();
      if (projects && projects.length > 0) {
        this.target.project = projects[0];
      } else {
        throw new Error('No projects found');
      }
    } catch (error) {
      let message = 'Projects cannot be fetched: ';
      message += error.statusText ? error.statusText + ': ' : '';
      if (error && error.data && error.data.error && error.data.error.message) {
        if (error.data.error.code === 403) {
          message += `
            A list of projects could not be fetched from the Google Cloud Resource Manager API.
            You might need to enable it first:
            https://console.developers.google.com/apis/library/cloudresourcemanager.googleapis.com`;
        } else {
          message += error.data.error.code + '. ' + error.data.error.message;
        }
      } else {
        message += 'Cannot connect to Stackdriver API';
      }
      appEvents.emit('ds-request-error', message);
    }
  }

  async getMetricTypes() {
    //projects/raintank-production/metricDescriptors/agent.googleapis.com/agent/api_request_count
    if (this.target.project.id !== 'default') {
      const metricTypes = await this.datasource.getMetricTypes(this.target.project.id);
      if (this.target.metricType === this.defaultDropdownValue && metricTypes.length > 0) {
        this.$scope.$apply(() => (this.target.metricType = metricTypes[0].id));
      }
      return metricTypes.map(mt => ({ value: mt.id, text: mt.id }));
    } else {
      return [];
    }
  }

  async getLabels() {
    this.loadLabelsPromise = new Promise(async resolve => {
      try {
        const data = await this.datasource.getTimeSeries({
          targets: [
            {
              refId: this.target.refId,
              datasourceId: this.datasource.id,
              metricType: this.target.metricType,
              aggregation: {
                crossSeriesReducer: 'REDUCE_NONE',
              },
              view: 'HEADERS',
            },
          ],
          range: this.timeSrv.timeRange(),
        });

        this.metricLabels = data.results[this.target.refId].meta.metricLabels;
        this.resourceLabels = data.results[this.target.refId].meta.resourceLabels;
        resolve();
      } catch (error) {
        resolve();
      }
    });
  }

  async onMetricTypeChange() {
    this.refresh();
    this.getLabels();
  }

  async getGroupBys(segment, index, removeText?: string, removeUsed = true) {
    await this.loadLabelsPromise;
    const metricLabels = Object.keys(this.metricLabels)
      .filter(ml => {
        if (!removeUsed) {
          return true;
        }
        return this.target.aggregation.groupBys.indexOf('metric.label.' + ml) === -1;
      })
      .map(l => {
        return this.uiSegmentSrv.newSegment({
          value: `metric.label.${l}`,
          expandable: false,
        });
      });

    const resourceLabels = Object.keys(this.resourceLabels)
      .filter(ml => {
        if (!removeUsed) {
          return true;
        }

        return this.target.aggregation.groupBys.indexOf('resource.label.' + ml) === -1;
      })
      .map(l => {
        return this.uiSegmentSrv.newSegment({
          value: `resource.label.${l}`,
          expandable: false,
        });
      });

    const noValueOrPlusButton = !segment || segment.type === 'plus-button';
    if (noValueOrPlusButton && metricLabels.length === 0 && resourceLabels.length === 0) {
      return Promise.resolve([]);
    }

    this.removeSegment.value = removeText || this.defaultRemoveGroupByValue;
    return Promise.resolve([...metricLabels, ...resourceLabels, this.removeSegment]);
  }

  groupByChanged(segment, index) {
    if (segment.value === this.removeSegment.value) {
      this.groupBySegments.splice(index, 1);
    } else {
      segment.type = 'value';
    }

    const reducer = (memo, seg) => {
      if (!seg.fake) {
        memo.push(seg.value);
      }
      return memo;
    };

    this.target.aggregation.groupBys = this.groupBySegments.reduce(reducer, []);
    this.ensurePlusButton(this.groupBySegments);
    this.refresh();
  }

  async getFilters(segment, index) {
    if (segment.type === 'condition') {
      return [this.uiSegmentSrv.newSegment('AND')];
    }

    if (segment.type === 'operator') {
      return this.uiSegmentSrv.newOperators(['=', '!=', '=~', '!=~']);
    }

    if (segment.type === 'key' || segment.type === 'plus-button') {
      if (
        this.metricLabels &&
        Object.keys(this.metricLabels).length === 0 &&
        segment.value &&
        segment.value !== this.defaultRemoveFilterValue
      ) {
        this.removeSegment.value = this.defaultRemoveFilterValue;
        return Promise.resolve([this.removeSegment]);
      } else {
        return this.getGroupBys(null, null, this.defaultRemoveFilterValue, false);
      }
    }

    if (segment.type === 'value') {
      const filterKey = this.filterSegments[index - 2].value;
      const shortKey = filterKey.substring(filterKey.indexOf('.label.') + 7);

      if (filterKey.startsWith('metric.label.') && this.metricLabels.hasOwnProperty(shortKey)) {
        return this.getValuesForFilterKey(this.metricLabels[shortKey]);
      }

      if (filterKey.startsWith('resource.label.') && this.resourceLabels.hasOwnProperty(shortKey)) {
        return this.getValuesForFilterKey(this.resourceLabels[shortKey]);
      }
    }

    return [];
  }

  getValuesForFilterKey(labels: any[]) {
    const filterValues = labels.map(l => {
      return this.uiSegmentSrv.newSegment({
        value: `${l}`,
        expandable: false,
      });
    });

    return filterValues;
  }

  filterSegmentUpdated(segment, index) {
    if (segment.type === 'plus-button') {
      this.addNewFilterSegments(segment, index);
    } else if (segment.type === 'key' && segment.value === this.defaultRemoveFilterValue) {
      this.removeFilterSegment(index);
      this.ensurePlusButton(this.filterSegments);
    } else if (segment.type === 'value' && segment.value !== this.defaultFilterValue) {
      this.ensurePlusButton(this.filterSegments);
    }

    this.target.filters = this.filterSegments.filter(s => s.type !== 'plus-button').map(seg => seg.value);
    this.refresh();
  }

  addNewFilterSegments(segment, index) {
    if (index > 2) {
      this.filterSegments.splice(index, 0, this.uiSegmentSrv.newCondition('AND'));
    }
    segment.type = 'key';
    this.filterSegments.push(this.uiSegmentSrv.newOperator('='));
    this.filterSegments.push(this.uiSegmentSrv.newFake(this.defaultFilterValue, 'value', 'query-segment-value'));
  }

  removeFilterSegment(index) {
    this.filterSegments.splice(index, 3);
    // remove trailing condition
    if (index > 2 && this.filterSegments[index - 1].type === 'condition') {
      this.filterSegments.splice(index - 1, 1);
    }

    // remove condition if it is first segment
    if (index === 0 && this.filterSegments[0].type === 'condition') {
      this.filterSegments.splice(0, 1);
    }
  }

  ensurePlusButton(segments) {
    const count = segments.length;
    const lastSegment = segments[Math.max(count - 1, 0)];

    if (!lastSegment || lastSegment.type !== 'plus-button') {
      segments.push(this.uiSegmentSrv.newPlusButton());
    }
  }

  onDataReceived(dataList) {
    this.lastQueryError = null;
    this.lastQueryMeta = null;

    const anySeriesFromQuery: any = _.find(dataList, { refId: this.target.refId });
    if (anySeriesFromQuery) {
      this.lastQueryMeta = anySeriesFromQuery.meta;
      this.lastQueryMeta.rawQueryString = decodeURIComponent(this.lastQueryMeta.rawQuery);
    } else {
    }
  }

  onDataError(err) {
    if (err.data && err.data.results) {
      const queryRes = err.data.results[this.target.refId];
      if (queryRes && queryRes.error) {
        this.lastQueryMeta = queryRes.meta;
        this.lastQueryMeta.rawQueryString = decodeURIComponent(this.lastQueryMeta.rawQuery);

        let jsonBody;
        try {
          jsonBody = JSON.parse(queryRes.error);
        } catch {
          this.lastQueryError = queryRes.error;
        }

        this.lastQueryError = jsonBody.error.message;
      }
    }
    console.error(err);
  }
}
