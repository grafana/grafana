///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import config from 'app/core/config';
import {PanelCtrl} from 'app/plugins/sdk';
import {impressions} from 'app/features/dashboard/impression_store';

 // Set and populate defaults
var panelDefaults = {
  mode: 'starred',
  query: '',
  limit: 10,
  tags: []
};

class DashListCtrl extends PanelCtrl {
  static templateUrl = 'module.html';

  dashList: any[];
  modes: any[];

  /** @ngInject */
  constructor($scope, $injector, private backendSrv) {
    super($scope, $injector);
    _.defaults(this.panel, panelDefaults);

    if (this.panel.tag) {
      this.panel.tags = [this.panel.tag];
      delete this.panel.tag;
    }

    this.events.on('refresh', this.onRefresh.bind(this));
    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
  }

  onInitEditMode() {
    this.editorTabIndex = 1;
    this.modes = ['starred', 'search', 'recently viewed'];
    this.addEditorTab('Options', 'public/app/plugins/panel/dashlist/editor.html');
  }

  onRefresh() {
    var params: any = {limit: this.panel.limit};

    if (this.panel.mode === 'recently viewed') {
      var dashIds = _.first(impressions.getDashboardOpened(), this.panel.limit);

      return this.backendSrv.search({dashboardIds: dashIds, limit: this.panel.limit}).then(result => {
        this.dashList = dashIds.map(orderId => {
          return _.find(result, dashboard => {
            return dashboard.id === orderId;
          });
        }).filter(el => {
          return el !== undefined;
        });

        this.renderingCompleted();
      });
    }

    if (this.panel.mode === 'starred') {
      params.starred = "true";
    } else {
      params.query = this.panel.query;
      params.tag = this.panel.tags;
    }

    return this.backendSrv.search(params).then(result => {
      this.dashList = result;
      this.renderingCompleted();
    });
  }
}

export {DashListCtrl, DashListCtrl as PanelCtrl}
