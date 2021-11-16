import coreModule from 'app/angular/core_module';

export class AlertSrv {
  constructor() {}

  set() {
    console.warn('old deprecated alert srv being used');
  }
}

// this is just added to not break old plugins that might be using it
coreModule.service('alertSrv', AlertSrv);
