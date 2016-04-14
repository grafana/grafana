///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import angular from 'angular';
import _ from 'lodash';

import {DynamicDashboardSrv} from './dynamic_dashboard_srv';

export class DashboardExporter {

  makeExportable(dashboard) {
    var dynSrv = new DynamicDashboardSrv();
    dynSrv.process(dashboard, {cleanUpOnly: true});

    return dashboard;
  }

  export(dashboard) {
    var clean = this.makeExportable(dashboard);
    var blob = new Blob([angular.toJson(clean, true)], { type: "application/json;charset=utf-8" });
    var wnd: any = window;
    wnd.saveAs(blob, clean.title + '-' + new Date().getTime());
  }

}



