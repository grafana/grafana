///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import moment from 'moment';

export class AddAnnotationModalCtrl {
  annotationTime: any;
  annotationTimeFormat = 'YYYY-MM-DD HH:mm:ss';
  annotation: any;
  graphCtrl: any;

  /** @ngInject */
  constructor(private $scope) {
    this.graphCtrl = $scope.ctrl;
    $scope.ctrl = this;

    this.annotation = {
      time: null,
      title: "",
      text: ""
    };

    this.annotationTime = moment(this.$scope.annotationTimeUnix).format(this.annotationTimeFormat);
  }

  addAnnotation() {
    let time = moment(this.annotationTime, this.annotationTimeFormat);
    this.annotation.time = time.valueOf();

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
    this.graphCtrl.inAddAnnotationMode = false;
    this.$scope.dismiss();
  }
}

angular
  .module('grafana.controllers')
  .controller('AddAnnotationModalCtrl', AddAnnotationModalCtrl);
