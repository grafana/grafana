///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import coreModule from 'app/core/core_module';

export class EventEditorCtrl {
  /** @ngInject */
  constructor() {
  }
}

export function eventEditor() {
  return {
    restrict: 'E',
    controller: EventEditorCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    templateUrl: 'public/app/features/dashboard/partials/event_editor.html',
  };
}

coreModule.directive('eventEditor', eventEditor);
