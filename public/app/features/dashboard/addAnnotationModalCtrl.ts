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
  graphCtrl: any;

  /** @ngInject */
  constructor(private $scope) {
    this.graphCtrl = $scope.ctrl;
    $scope.ctrl = this;

    this.annotationTimeFrom = moment($scope.annotationTimeRange.from).format(this.annotationTimeFormat);
    if ($scope.annotationTimeRange.to) {
      this.annotationTimeTo = moment($scope.annotationTimeRange.to).format(this.annotationTimeFormat);
    }
  }

  addAnnotation() {
    let dashboardId = this.graphCtrl.dashboard.id;
    let panelId = this.graphCtrl.panel.id;
    let timeFrom = moment(this.annotationTimeFrom, this.annotationTimeFormat).valueOf();

    let annotationFrom = {
      dashboardId: dashboardId,
      panelId: panelId,
      time: timeFrom,
      title: this.annotationTitle,
      text: this.annotationTextFrom
    };
    let annotations = [annotationFrom];

    if (this.annotationTimeTo) {
      let timeTo = moment(this.annotationTimeTo, this.annotationTimeFormat).valueOf();
      let annotationTo = {
        dashboardId: dashboardId,
        panelId: panelId,
        time: timeTo,
        title: this.annotationTitle,
        text: this.annotationTextTo
      };
      annotations.push(annotationTo);
    }

    this.graphCtrl.pushAnnotations(annotations)
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
