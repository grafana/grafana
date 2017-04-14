///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import moment from 'moment';

export class AddAnnotationModalCtrl {
  timeFormat = 'YYYY-MM-DD HH:mm:ss';
  annotation: any;
  graphCtrl: any;

  /** @ngInject */
  constructor(private $scope) {
    this.graphCtrl = $scope.ctrl;
    $scope.ctrl = this;

    let dashboardId = this.graphCtrl.dashboard.id;
    let panelId = this.graphCtrl.panel.id;
    this.annotation = {
      dashboardId: dashboardId,
      panelId: panelId,
      time: null,
      timeTo: null,
      title: "",
      text: ""
    };

    this.annotation.time = moment($scope.annotationTimeRange.from).format(this.timeFormat);0
    if ($scope.annotationTimeRange.to) {
      this.annotation.timeTo = moment($scope.annotationTimeRange.to).format(this.timeFormat);
    }
  }

  addAnnotation() {
    this.annotation.time = moment(this.annotation.time, this.timeFormat).valueOf();
    if (this.annotation.timeTo) {
      this.annotation.timeTo = moment(this.annotation.timeTo, this.timeFormat).valueOf();
    }

    this.graphCtrl.pushAnnotation(this.annotation)
    .then(response => {
      this.close();
    })
    .catch(error => {
      console.log(error);
      this.close();
    });
  }

  close() {
    this.$scope.dismiss();
  }
}

angular
  .module('grafana.controllers')
  .controller('AddAnnotationModalCtrl', AddAnnotationModalCtrl);
