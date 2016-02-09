///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import config from 'app/core/config';
import {PanelCtrl} from 'app/plugins/sdk';

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
      this.panel.tags = [$scope.panel.tag];
      delete this.panel.tag;
    }
  }

  initEditMode() {
    super.initEditMode();
    this.modes = ['starred', 'search'];
    this.icon = "fa fa-star";
    this.addEditorTab('Options', () => {
      return {templateUrl: 'public/app/plugins/panel/dashlist/editor.html'};
    });
  }

  refresh() {
    var params: any = {limit: this.panel.limit};

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
