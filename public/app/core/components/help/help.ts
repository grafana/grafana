///<reference path="../../../headers/common.d.ts" />

import coreModule from '../../core_module';
import appEvents from 'app/core/app_events';

export class HelpCtrl {
  tabIndex: any;
  shortcuts: any;

  /** @ngInject */
  constructor(private $scope) {
    this.tabIndex = 0;
    this.shortcuts = {
      'Global': [
        {key: 'g h', description: 'Go to Home Dashboard'},
        {key: 'g p', description: 'Go to Profile'},
        {key: 's o', description: 'Open search'},
        {key: 's s', description: 'Open search with starred filter'},
        {key: 's t', description: 'Open search in tags view'},
        {key: 'esc', description: 'Exit edit/setting views'},
      ],
      'Focused Panel': [
        {key: 'e',   description: 'Toggle panel edit view'},
        {key: 'v', description: 'Toggle panel fullscreen view'},
        {key: 'p s', description: 'Open Panel Share Modal'},
        {key: 'p r', description: 'Remove Panel'},
      ],
      'Focused Row': [
        {key: 'r c', description: 'Collapse Row'},
        {key: 'r r', description: 'Remove Row'},
      ],
      'Dashboard': [
        {key: 'mod+s', description: 'Save dashboard'},
        {key: 'mod+h', description: 'Hide row controls'},
        {key: 'd r', description: 'Refresh all panels'},
        {key: 'd s', description: 'Dashboard settings'},
        {key: 'mod+o', description: 'Toggle shared graph crosshair'},
      ],
      'Time Range': [
        {key: 't z', description: 'Zoom out time range'},
        {key: 't left', description: 'Move time range back'},
        {key: 't right', description: 'Move time range forward'},
      ],
    };
  }

  dismiss() {
    appEvents.emit('hide-modal');
  }
}

export function helpModal() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/core/components/help/help.html',
    controller: HelpCtrl,
    bindToController: true,
    transclude: true,
    controllerAs: 'ctrl',
    scope: {},
  };
}

coreModule.directive('helpModal', helpModal);
