///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import moment from 'moment';

export class AddAnnotationModalCtrl {
  annotationTimeFormat = 'YYYY-MM-DD HH:mm:ss';
  annotationTimeFrom: any;
  annotationTimeTo: any = null;
  annotationTitle: string;
  annotationTextFrom: string;
  annotationTextTo: string;
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

    this.annotation.time = moment($scope.annotationTimeRange.from).format(this.annotationTimeFormat);
    if ($scope.annotationTimeRange.to) {
      this.annotation.timeTo = moment($scope.annotationTimeRange.to).format(this.annotationTimeFormat);
    }
  }

  addAnnotation() {
    this.annotation.time = moment(this.annotation.time, this.annotationTimeFormat).valueOf();
    if (this.annotation.timeTo) {
      this.annotation.timeTo = moment(this.annotation.timeTo, this.annotationTimeFormat).valueOf();
    }

    this.graphCtrl.pushAnnotation(this.annotation)
    .then(response => {
      console.log(response);
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
