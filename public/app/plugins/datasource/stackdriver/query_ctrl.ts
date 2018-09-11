import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
import appEvents from 'app/core/app_events';

export interface QueryMeta {
  rawQuery: string;
  rawQueryString: string;
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
  };
  defaultDropdownValue = 'Select metric';

  defaults = {
    project: {
      id: 'default',
      name: 'loading project...',
    },
    // metricType: this.defaultDropdownValue,
  };

  showHelp: boolean;
  showLastQuery: boolean;
  lastQueryMeta: QueryMeta;
  lastQueryError?: string;

  /** @ngInject */
  constructor($scope, $injector) {
    super($scope, $injector);
    _.defaultsDeep(this.target, this.defaults);

    this.panelCtrl.events.on('data-received', this.onDataReceived.bind(this), $scope);
    this.panelCtrl.events.on('data-error', this.onDataError.bind(this), $scope);

    this.getCurrentProject().then(this.getMetricTypes.bind(this));
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
