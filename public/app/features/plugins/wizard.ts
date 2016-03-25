///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';

export class WizardSrv {

  /** @ngInject */
  constructor() {
  }

}

export class WizardStep {
  name: string;
  fn: any;
}

export class WizardFlow {
  name: string;
  steps: WizardStep[];

  constructor(name) {
    this.name = name;
    this.steps = [];
  }

  addStep(name, stepFn) {
    this.steps.push({
      name: name,
      fn: stepFn
    });
  }

  start() {
    appEvents.emit('show-modal', {
      src: 'public/app/features/plugins/partials/wizard.html',
      model: this
    });
  }
}

coreModule.service('wizardSrv', WizardSrv);
