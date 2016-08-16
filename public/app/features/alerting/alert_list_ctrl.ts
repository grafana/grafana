///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import coreModule from '../../core/core_module';
import moment from 'moment';
import alertDef from './alert_def';

export class AlertListCtrl {

  alerts: any;
  filters = {
    state: 'OK'
  };

  /** @ngInject */
  constructor(private backendSrv, private $route) {
    _.each($route.current.params.state, state => {
      this.filters[state.toLowerCase()] = true;
    });

    this.loadAlerts();
  }

  updateFilter() {
    var stats = [];
    this.$route.current.params.state = stats;
    this.$route.updateParams();
  }

  loadAlerts() {
    var stats = [];

    var params = {
      state: stats
    };

    this.backendSrv.get('/api/alerts', params).then(result => {
      this.alerts = _.map(result, alert => {
        alert.stateModel = alertDef.getStateDisplayModel(alert.state, alert.severity);
        alert.newStateDateAgo = moment(alert.newStateDate).fromNow().replace(" ago", "");
        return alert;
      });
    });
  }
}

coreModule.controller('AlertListCtrl', AlertListCtrl);

