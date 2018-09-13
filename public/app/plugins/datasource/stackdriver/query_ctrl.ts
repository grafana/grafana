import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
import appEvents from 'app/core/app_events';

export interface QueryMeta {
  rawQuery: string;
  rawQueryString: string;
  metricLabels: any;
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
  };

  groupBySegments: any[];

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

  /** @ngInject */
  constructor($scope, $injector, private uiSegmentSrv) {
    super($scope, $injector);
    _.defaultsDeep(this.target, this.defaults);

    this.panelCtrl.events.on('data-received', this.onDataReceived.bind(this), $scope);
    this.panelCtrl.events.on('data-error', this.onDataError.bind(this), $scope);

    this.getCurrentProject().then(this.getMetricTypes.bind(this));

    this.groupBySegments = _.map(this.target.aggregation.groupBys, groupBy => {
      return uiSegmentSrv.getSegmentForValue(groupBy);
    });
    this.ensurePlusButton(this.groupBySegments);
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

  getGroupBys() {
    const segments = _.map(Object.keys(this.lastQueryMeta.metricLabels), (label: string) => {
      return this.uiSegmentSrv.newSegment({ value: label, expandable: false });
    });

    return Promise.resolve(segments);
  }

  groupByChanged(segment, index) {
    this.target.aggregation.groupBys = _.reduce(
      this.groupBySegments,
      function(memo, seg) {
        if (!seg.fake) {
          memo.push(seg.value);
        }
        return memo;
      },
      []
    );
    this.ensurePlusButton(this.groupBySegments);
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
