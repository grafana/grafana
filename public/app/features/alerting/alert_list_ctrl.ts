///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import moment from 'moment';

import {coreModule, appEvents} from  'app/core/core';
import alertDef from './alert_def';

export class AlertListCtrl {
  alerts: any;
  stateFilters = [
    {text: 'All', value: null},
    {text: 'OK', value: 'ok'},
    {text: 'Alerting', value: 'alerting'},
    {text: 'No Data', value: 'no_data'},
    {text: 'Paused', value: 'paused'},
  ];
  filters = {
    state: 'ALL'
  };
  navModel: any;

  /** @ngInject */
  constructor(private backendSrv, private $location, private $scope, navModelSrv) {
    this.navModel = navModelSrv.getAlertingNav(0);

    var params = $location.search();
    this.filters.state = params.state || null;
    this.loadAlerts();
  }

  filtersChanged() {
    this.$location.search(this.filters);
  }

  loadAlerts() {
    this.backendSrv.get('/api/alerts', this.filters).then(result => {
      this.alerts = _.map(result, alert => {
        alert.stateModel = alertDef.getStateDisplayModel(alert.state);
        alert.newStateDateAgo = moment(alert.newStateDate).fromNow().replace(" ago", "");
        if (alert.evalData && alert.evalData.no_data) {
          alert.no_data = true;
        }
        return alert;
      });
    });
  }

  pauseAlertRule(alertId: any) {
    var alert = _.find(this.alerts, {id: alertId});

    var payload = {
      paused: alert.state !== "paused"
    };

    this.backendSrv.post(`/api/alerts/${alert.id}/pause`, payload).then(result => {
      alert.state = result.state;
      alert.stateModel = alertDef.getStateDisplayModel(result.state);
    });
  }

  openHowTo() {
    appEvents.emit('show-modal', {
      src: 'public/app/features/alerting/partials/alert_howto.html',
      modalClass: 'confirm-modal',
      model: {}
    });
  }
}

coreModule.controller('AlertListCtrl', AlertListCtrl);

