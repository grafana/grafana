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

export interface WizardStep {
  name: string;
  type: string;
  process: any;
}

export class SelectOptionStep {
  type: string;
  name: string;
  fulfill: any;

  constructor() {
    this.type = 'select';
  }

  process() {
    return new Promise((fulfill, reject) => {

    });
  }
}

export class WizardFlow {
  name: string;
  steps: WizardStep[];

  constructor(name) {
    this.name = name;
    this.steps = [];
  }

  addStep(step) {
    this.steps.push(step);
  }

  next(index) {
    var step = this.steps[0];

    return step.process().then(() => {
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
