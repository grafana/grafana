import angular from 'angular';
import coreModule from 'app/core/core_module';

export interface AttachedPanel {
  destroy();
}

export class PanelLoader {
  /** @ngInject */
  constructor(private $compile, private $rootScope) {}

  load(elem, panel, dashboard): AttachedPanel {
    var template = '<plugin-component type="panel" class="panel-height-helper"></plugin-component>';
    var panelScope = this.$rootScope.$new();
    panelScope.panel = panel;
    panelScope.dashboard = dashboard;

    const compiledElem = this.$compile(template)(panelScope);
    const rootNode = angular.element(elem);
    rootNode.append(compiledElem);

    return {
      destroy: () => {
        panelScope.$destroy();
        compiledElem.remove();
      },
    };
  }
}

coreModule.service('panelLoader', PanelLoader);
