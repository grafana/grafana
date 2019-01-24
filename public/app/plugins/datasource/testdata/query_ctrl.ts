import _ from 'lodash';

import { QueryCtrl } from 'app/plugins/sdk';
import moment from 'moment';

export class TestDataQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  scenarioList: any;
  scenario: any;
  newPointValue: number;
  newPointTime: any;
  selectedPoint: any;

  /** @ngInject */
  constructor($scope, $injector, private backendSrv) {
    super($scope, $injector);

    this.target.scenarioId = this.target.scenarioId || 'random_walk';
    this.scenarioList = [];
    this.newPointTime = moment();
    this.selectedPoint = { text: 'Select point', value: null };
  }

  getPoints() {
    return _.map(this.target.points, (point, index) => {
      return {
        text: moment(point[1]).format('MMMM Do YYYY, H:mm:ss') + ' : ' + point[0],
        value: index,
      };
    });
  }

  pointSelected(option) {
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
    return this.backendSrv.get('/api/tsdb/testdata/scenarios').then(res => {
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

    this.refresh();
  }
}
