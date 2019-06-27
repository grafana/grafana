import _ from 'lodash';

import { QueryCtrl } from 'app/plugins/sdk';
import { defaultQuery } from './StreamHandler';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { dateTime } from '@grafana/ui/src/utils/moment_wrapper';

export class TestDataQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  scenarioList: any;
  scenario: any;
  newPointValue: number;
  newPointTime: any;
  selectedPoint: any;

  /** @ngInject */
  constructor($scope: any, $injector: any) {
    super($scope, $injector);

    this.target.scenarioId = this.target.scenarioId || 'random_walk';
    this.scenarioList = [];
    this.newPointTime = dateTime();
    this.selectedPoint = { text: 'Select point', value: null };
  }

  getPoints() {
    return _.map(this.target.points, (point, index) => {
      return {
        text: dateTime(point[1]).format('MMMM Do YYYY, H:mm:ss') + ' : ' + point[0],
        value: index,
      };
    });
  }

  pointSelected(option: any) {
    this.selectedPoint = option;
  }

  deletePoint() {
    this.target.points.splice(this.selectedPoint.value, 1);
    this.selectedPoint = { text: 'Select point', value: null };
    this.refresh();
  }

  addPoint() {
    this.target.points = this.target.points || [];
    this.target.points.push([this.newPointValue, this.newPointTime.valueOf()]);
    this.target.points = _.sortBy(this.target.points, p => p[1]);
    this.refresh();
  }

  $onInit() {
    return getBackendSrv()
      .get('/api/tsdb/testdata/scenarios')
      .then((res: any) => {
        this.scenarioList = res;
        this.scenario = _.find(this.scenarioList, { id: this.target.scenarioId });
      });
  }

  scenarioChanged() {
    this.scenario = _.find(this.scenarioList, { id: this.target.scenarioId });
    this.target.stringInput = this.scenario.stringInput;

    if (this.target.scenarioId === 'manual_entry') {
      this.target.points = this.target.points || [];
    } else {
      delete this.target.points;
    }

    if (this.target.scenarioId === 'streaming_client') {
      this.target.stream = _.defaults(this.target.stream || {}, defaultQuery);
    } else {
      delete this.target.stream;
    }

    this.refresh();
  }

  streamChanged() {
    this.refresh();
  }
}
