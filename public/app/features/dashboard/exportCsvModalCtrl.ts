///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import angular from 'angular';
import _ from 'lodash';
import * as fileExport from 'app/core/utils/file_export';

const module = angular.module('grafana.controllers');

export class ExportCsvModalCtrl {
  scope: any;
  seriesList: any = [];
  /** @ngInject */
  constructor(private $scope) {
    this.seriesList = $scope.seriesList;
    this.$scope = $scope;
    $scope.asRows = true;
    $scope.dateTimeFormat = 'YYYY-MM-DDTHH:mm:ssZ';
    $scope.export = this.export.bind(this);
  }

  export() {
    if (this.$scope.asRows) {
      fileExport.exportSeriesListToCsv(this.seriesList, this.$scope.dateTimeFormat);
    } else {
      fileExport.exportSeriesListToCsvColumns(this.seriesList, this.$scope.dateTimeFormat);
    }
    this.$scope.dismiss();
  }
}

module.controller('ExportCsvModalCtrl', ExportCsvModalCtrl);
