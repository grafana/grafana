///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import coreModule from '../../../core/core_module';
import * as fileExport from '../../../core/utils/file_export';

export class ExportCsvCtrl {

  public exportModesAvail: any;
  public exportTzAvail: any;
  public exportTz: string;
  public exportMode: string;

  /** @ngInject */
  constructor(private $scope) {
    this.exportModesAvail = {
      'rows': 'Rows',
      'cols': 'Columns'
    };
    this.exportTzAvail = {
      "-12:00": "UTC−12:00",
      "-11:00": "UTC−11:00",
      "-10:00": "UTC−10:00",
      "-09:30": "UTC−09:30",
      "-09:00": "UTC−09:00",
      "-08:00": "UTC−08:00",
      "-07:00": "UTC−07:00",
      "-06:00": "UTC−06:00",
      "-05:00": "UTC−05:00",
      "-04:00": "UTC−04:00",
      "-03:30": "UTC−03:30",
      "-03:00": "UTC−03:00",
      "-02:00": "UTC−02:00",
      "-01:00": "UTC−01:00",
      "00:00": "UTC",
      "browser": "Browser Timezone",
      "+01:00": "UTC+01:00",
      "+02:00": "UTC+02:00",
      "+03:00": "UTC+03:00",
      "+03:30": "UTC+03:30",
      "+04:00": "UTC+04:00",
      "+04:30": "UTC+04:30",
      "+05:00": "UTC+05:00",
      "+05:30": "UTC+05:30",
      "+05:45": "UTC+05:45",
      "+06:00": "UTC+06:00",
      "+06:30": "UTC+06:30",
      "+07:00": "UTC+07:00",
      "+08:00": "UTC+08:00",
      "+08:30": "UTC+08:30",
      "+08:45": "UTC+08:45",
      "+09:00": "UTC+09:00",
      "+09:30": "UTC+09:30",
      "+10:00": "UTC+10:00",
      "+10:30": "UTC+10:30",
      "+11:00": "UTC+11:00",
      "+12:00": "UTC+12:00",
      "+12:45": "UTC+12:45",
      "+13:00": "UTC+13:00",
      "+14:00": "UTC+14:00"
    };
    this.exportTz = '00:00';
    this.exportMode = 'rows';
  }

  private offsetTz(): any {
    if (this.exportTz === 'browser') {
      // Reverse the timezone offset for moment.js, which is used in the fileExport
      return (new Date().getTimezoneOffset()) * -1;
    }

    return this.exportTz;
  }

  public exportCsv() {
    if (this.exportMode === 'cols') {
      fileExport.exportSeriesListToCsvColumns(this.$scope.seriesList, this.offsetTz());
    } else {
      fileExport.exportSeriesListToCsv(this.$scope.seriesList, this.offsetTz());
    }
  }
}

coreModule.controller('ExportCsvCtrl', ExportCsvCtrl);
