///<reference path="../../../headers/common.d.ts" />

import kbn from 'app/core/utils/kbn';
import coreModule from 'app/core/core_module';

import appEvents from 'app/core/app_events';
import {WizardFlow} from 'app/core/core';

var wnd: any = window;

export class DashImporter {
  step: number;
  jsonText: string;
  parseError: string;
  nameExists: boolean;
  dash: any;
  dismiss: any;

  constructor(private backendSrv, private $location) {
  }

  onUpload(dash) {
    this.dash = dash;
    this.dash.id = null;

    this.backendSrv.saveDashboard(this.dash, {overwrite: false}).then(res => {

    }).catch(err => {
      if (err.data.status === 'name-exists') {
        err.isHandled = true;
        this.step = 2;
        this.nameExists = true;
      }
      console.log(err);
    });
  }

  titleChanged() {
    this.backendSrv.search({query: this.dash.title}).then(res => {
      this.nameExists = false;
      for (let hit of res) {
        if (this.dash.title === hit.title) {
          this.nameExists = true;
          break;
        }
      }
    });
  }

  saveDashboard() {
    return this.backendSrv.saveDashboard(this.dash, {overwrite: true}).then(res => {
      this.$location.url('dashboard/db/' + res.slug);
      this.dismiss();
    });
  }

  loadJsonText() {
    try {
      this.parseError = '';
      var dash = JSON.parse(this.jsonText);
      this.onUpload(dash);
    } catch (err) {
      console.log(err);
      this.parseError = err.message;
      return;
    }
  }

  run() {
    this.step = 0;

    appEvents.emit('show-modal', {
      src: 'public/app/core/components/dash_importer/dash_importer.html',
      model: this
    });
  }
}
