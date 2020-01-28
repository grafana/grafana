import _ from 'lodash';
import { dateMath, dateTime } from '@grafana/data';
import { e2e } from '@grafana/e2e';

import { QueryCtrl } from 'app/plugins/sdk';
import { defaultQuery } from './runStreams';
import { getBackendSrv } from '@grafana/runtime';
import { promiseToDigest } from 'app/core/utils/promiseToDigest';
import { IScope } from 'angular';

export const defaultPulse: any = {
  timeStep: 60,
  onCount: 3,
  onValue: 2,
  offCount: 3,
  offValue: 1,
};

export const defaultCSVWave: any = {
  timeStep: 60,
  valuesCSV: '0,0,2,2,1,1',
};

const showLabelsFor = ['random_walk', 'predictable_pulse', 'predictable_csv_wave'];

export class TestDataQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  scenarioList: any;
  scenario: any;
  newPointValue: number;
  newPointTime: any;
  selectedPoint: any;
  digest: (promise: Promise<any>) => Promise<any>;

  showLabels = false;
  selectors: typeof e2e.pages.Dashboard.Panels.DataSource.TestData.QueryTab.selectors;

  /** @ngInject */
  constructor($scope: IScope, $injector: any) {
    super($scope, $injector);

    this.target.scenarioId = this.target.scenarioId || 'random_walk';
    this.scenarioList = [];
    this.newPointTime = dateTime();
    this.selectedPoint = { text: 'Select point', value: null };
    this.showLabels = showLabelsFor.includes(this.target.scenarioId);
    this.selectors = e2e.pages.Dashboard.Panels.DataSource.TestData.QueryTab.selectors;
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
    this.newPointTime = dateMath.parse(this.newPointTime);
    this.target.points.push([this.newPointValue, this.newPointTime.valueOf()]);
    this.target.points = _.sortBy(this.target.points, p => p[1]);
    this.refresh();
  }

  $onInit() {
    return promiseToDigest(this.$scope)(
      getBackendSrv()
        .get('/api/tsdb/testdata/scenarios')
        .then((res: any) => {
          this.scenarioList = res;
          this.scenario = _.find(this.scenarioList, { id: this.target.scenarioId });
        })
    );
  }

  scenarioChanged() {
    this.scenario = _.find(this.scenarioList, { id: this.target.scenarioId });
    this.target.stringInput = this.scenario.stringInput;
    this.showLabels = showLabelsFor.includes(this.target.scenarioId);

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

    if (this.target.scenarioId === 'predictable_pulse') {
      this.target.pulseWave = _.defaults(this.target.pulseWave || {}, defaultPulse);
    } else {
      delete this.target.pulseWave;
    }

    if (this.target.scenarioId === 'predictable_csv_wave') {
      this.target.csvWave = _.defaults(this.target.csvWave || {}, defaultCSVWave);
    } else {
      delete this.target.csvWave;
    }

    this.refresh();
  }

  streamChanged() {
    this.refresh();
  }
}
