///<reference path="../../headers/common.d.ts" />

import {Subject} from 'vendor/npm/rxjs/Subject';

var hasOwnProp = {}.hasOwnProperty;

function createName(name) {
    return '$' + name;
}

export class Emitter {
  subjects: any;

  constructor() {
    this.subjects = {};
  }

  emit(name, data?) {
    var fnName = createName(name);
    this.subjects[fnName] || (this.subjects[fnName] = new Subject());
    this.subjects[fnName].next(data);
  }

  on(name, handler, scope?) {
    var fnName = createName(name);
    this.subjects[fnName] || (this.subjects[fnName] = new Subject());
    var subscription = this.subjects[fnName].subscribe(handler);

    if (scope) {
      scope.$on('$destroy', function() {
        subscription.unsubscribe();
      });
    }

    return subscription;
  };

  off(name, handler) {
    var fnName = createName(name);
    if (this.subjects[fnName]) {
      this.subjects[fnName].dispose();
      delete this.subjects[fnName];
    }
  }

  dispose() {
    var subjects = this.subjects;
    for (var prop in subjects) {
      if (hasOwnProp.call(subjects, prop)) {
        subjects[prop].dispose();
      }
    }

    this.subjects = {};
  }
}
