import angular from 'angular';
import config from 'app/core/config';
import _ from 'lodash';
import { PanelModel } from '../panel_model';

export class DashPanelsEditorCtrl {
  dashboard: any;

  stats: any;
  panels: PanelModel[] = [];
  datasources: string[] = [];

  // Set in the UI
  showAlerts: false;
  showDescription: false;
  showDatasource: false;
  showGridPos: false;
  showRepeats: false;

  /** @ngInject */
  constructor(private $scope, private $rootScope, private $location) {
    $scope.ctrl = this;
    this.updateStats();
  }

  updateStats() {
    let stats = {
      alerts: 0,
      sources: [],
      descriptions: 0,
      repeat: 0,
      skip: {}, // id = true
    };
    let sources = {};

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
          sources[panel.datasource] = {
            name: panel.datasource,
            count: 1,
          };
        }
      }
      return true;
    });
    stats.sources = _.sortBy(_.values(sources), ['-count']);
    this.datasources = [''];
    for (let i = 0; i < stats.sources.length; i++) {
      this.datasources.push(stats.sources[i].name);
    }
    _.forEach(config.datasources, ds => {
      this.datasources.push(ds.name);
    });
    this.datasources = _.uniq(this.datasources);
    this.stats = stats;
  }

  getIconFor(panel) {
    if (panel) {
      let meta = config.panels[panel.type];
      if (_.has(meta, 'info.logos')) {
        let logos = meta.info.logos;
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
    this.$rootScope.appEvent('panel-change-view', {
      fullscreen: true,
      edit: false,
      panelId: panel.id,
    });
  }

  removePanel(panel) {
    console.log('Remove', panel);
    this.$scope.$root.appEvent('panel-remove', {
      panelId: panel.id,
    });
  }

  openDatasource(name: string, evt) {
    if (evt) {
      evt.preventDefault();
    }

    const cfg = _.get(config.datasources, name);
    if (cfg && cfg.id) {
      this.$location.url('datasources/edit/' + cfg.id);
    } else {
      console.log('Unable to find datasource', name, config.datasources);
    }
  }

  // Copiedfrom panel_ctrl... can we use the same one?
  editPanelJson(panel) {
    console.log('json', panel, this);
    let editScope = this.$scope.$root.$new();
    editScope.object = panel.getSaveModel();
    //   editScope.updateHandler = pctrl.bind(this);
    this.$scope.$root.appEvent('show-modal', {
      src: 'public/app/partials/edit_json.html',
      scope: editScope,
    });
  }
}

function dashPanelsEditor() {
  return {
    restrict: 'E',
    controller: DashPanelsEditorCtrl,
    templateUrl: 'public/app/features/dashboard/settings/panels.html',
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: '=',
    },
  };
}

angular.module('grafana.directives').directive('dashPanelsEditor', dashPanelsEditor);
