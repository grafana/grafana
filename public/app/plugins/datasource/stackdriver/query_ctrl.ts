import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
import appEvents from 'app/core/app_events';

export interface QueryMeta {
  rawQuery: string;
  rawQueryString: string;
  metricLabels: { [key: string]: string[] };
  resourceLabels: { [key: string]: string[] };
}

export interface Filter {
  key: string;
  operator: string;
  value: string;
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
      alignmentPeriod: string;
      perSeriesAligner: string;
      groupBys: string[];
    };
    filters: Filter[];
  };
  defaultDropdownValue = 'Select metric';

  defaults = {
    project: {
      id: 'default',
      name: 'loading project...',
    },
    metricType: this.defaultDropdownValue,
    aggregation: {
      crossSeriesReducer: 'REDUCE_MEAN',
      alignmentPeriod: '',
      perSeriesAligner: '',
      groupBys: [],
    },
    filters: [],
  };

  groupBySegments: any[];
  filterSegments: any[];
  removeSegment: any;

  aggOptions = [
    { text: 'none', value: 'REDUCE_NONE' },
    { text: 'mean', value: 'REDUCE_MEAN' },
    { text: 'min', value: 'REDUCE_MIN' },
    { text: 'max', value: 'REDUCE_MAX' },
    { text: 'sum', value: 'REDUCE_SUM' },
    { text: 'std. dev.', value: 'REDUCE_STDDEV' },
    { text: 'count', value: 'REDUCE_COUNT' },
    { text: '99th percentile', value: 'REDUCE_PERCENTILE_99' },
    { text: '95th percentile', value: 'REDUCE_PERCENTILE_95' },
    { text: '50th percentile', value: 'REDUCE_PERCENTILE_50' },
    { text: '5th percentile', value: 'REDUCE_PERCENTILE_05' },
  ];

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
    this.target.filters.forEach(f => {
      this.filterSegments.push(this.uiSegmentSrv.newKey(f.key));
      this.filterSegments.push(this.uiSegmentSrv.newOperator(f.operator));
      this.filterSegments.push(this.uiSegmentSrv.newKeyValue(f.value));
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
        this.$scope.$apply(() => (this.target.metricType = metricTypes[0].name));
      }
      return metricTypes.map(mt => ({ value: mt.id, text: mt.id }));
    } else {
      return [];
    }
  }

  async getLabels() {
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
  }

  async onMetricTypeChange() {
    this.refresh();
    this.getLabels();
  }

  getGroupBys(removeText?: string) {
    const metricLabels = Object.keys(this.metricLabels)
      .filter(ml => {
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
        return this.target.aggregation.groupBys.indexOf('resource.label.' + ml) === -1;
      })
      .map(l => {
        return this.uiSegmentSrv.newSegment({
          value: `resource.label.${l}`,
          expandable: false,
        });
      });

    this.removeSegment.value = removeText || '-- remove group by --';
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

  getFilters(segment, index) {
    if (segment.type === 'condition') {
      return [this.uiSegmentSrv.newSegment('AND')];
    }

    if (segment.type === 'operator') {
      return this.uiSegmentSrv.newOperators(['=', '!=', '=~', '!=~']);
    }

    if (segment.type === 'key' || segment.type === 'plus-button') {
      return this.getGroupBys('-- remove filter --');
    }

    if (segment.type === 'value') {
      const filterKey = this.filterSegments[index - 2].value;

      if (this.metricLabels[filterKey]) {
        return this.getValuesForFilterKey(this.metricLabels[filterKey]);
      }

      if (this.resourceLabels[filterKey]) {
        return this.getValuesForFilterKey(this.resourceLabels[filterKey]);
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
    }
  }

  onDataError(err) {
    if (err.data && err.data.results) {
      const queryRes = err.data.results[this.target.refId];
      if (queryRes) {
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
  }
}
