import angular from 'angular';
import config from 'app/core/config';
import _ from 'lodash';
import { PanelModel } from '../../state/PanelModel';

export class DSInfo {
  name: string = null;
  url: string = null;
  count = 0;

  constructor(name: string) {
    this.name = name;
  }
}

export class DashPanelsEditorCtrl {
  dashboard: any;

  stats: any;
  datasources: DSInfo[] = [];
  panels: PanelModel[] = [];

  // Set in the UI
  showAlerts: false;
  showDescription: false;
  showDatasource: false;
  showGridPos: false;
  showRepeats: false;

  /** @ngInject */
  constructor(private $scope, private $location) {
    $scope.ctrl = this;
    this.updateStats();
  }

  updateStats() {
    const stats = {
      alerts: 0,
      descriptions: 0,
      repeat: 0,
      skip: {}, // id = true
    };
    const sources = {};

    this.panels = _.filter(this.dashboard.panels, panel => {
      if (panel.repeatPanelId) {
        return false;
      }
      if (panel.alert) {
        stats.alerts++;
      }
      if (panel.description) {
        stats.descriptions++;
      }
      if (panel.repeat) {
        stats.repeat++;
      }
      if (panel.datasource) {
        if (_.has(sources, panel.datasource)) {
          sources[panel.datasource].count++;
        } else {
          sources[panel.datasource] = new DSInfo(panel.datasource);
          const cfg = _.get(config.datasources, panel.datasource);
          if (cfg && cfg.id) {
            sources[panel.datasource].url = 'datasources/edit/' + cfg.id;
          }
        }
      }
      return true;
    });
    this.datasources = _.sortBy(_.values(sources), ['-count']);
    this.stats = stats;
  }

  getIconFor(panel) {
    if (panel) {
      const meta = config.panels[panel.type];
      if (_.has(meta, 'info.logos')) {
        const logos = meta.info.logos;
        if (logos.small != null) {
          return logos.small;
        }
        if (logos.large != null) {
          return logos.large;
        }
      }
      if (this.isRow(panel)) {
        return '/public/img/icn-row.svg';
      }
    }
    return '/public/img/icn-panel.svg';
  }

  isRow(panel) {
    return 'row' === panel.type;
  }

  layoutChanged(panel) {
    // trigger grid re-layout.  May change the order
    panel.events.emit('panel-size-changed');
    this.dashboard.events.emit('row-expanded');
    this.updateStats();
  }

  showPanel(panel) {
    // Can't navigate to a row
    if (this.isRow(panel)) {
      return;
    }

    this.$location.search({
      panelId: panel.id,
      fullscreen: true,
    });
  }

  removePanel(panel) {
    this.$scope.$root.appEvent('panel-remove', {
      panelId: panel.id,
    });
  }
}

function dashPanelsEditor() {
  return {
    restrict: 'E',
    controller: DashPanelsEditorCtrl,
    templateUrl: 'public/app/features/dashboard/components/DashboardSettings/panels.html',
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: '=',
    },
  };
}

angular.module('grafana.directives').directive('dashPanelsEditor', dashPanelsEditor);
