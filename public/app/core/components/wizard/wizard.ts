///<reference path="../../../headers/common.d.ts" />

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
  reject: any;
  fulfill: any;

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

  next(index) {
    var step = this.steps[0];

    return step.fn().then(() => {
      if (this.steps.length === index+1) {
        return;
      }

      return this.next(index+1);
    });
  }

  start() {
    appEvents.emit('show-modal', {
      src: 'public/app/core/components/wizard/wizard.html',
      model: this
    });

    return this.next(0);
  }
}

coreModule.service('wizardSrv', WizardSrv);
