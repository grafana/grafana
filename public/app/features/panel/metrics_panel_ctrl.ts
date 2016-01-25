///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import {PanelCtrl} from './panel_ctrl';

class MetricsPanelCtrl extends PanelCtrl {
  error: boolean;
  loading: boolean;
  datasource: any;
  $q: any;
  datasourceSrv: any;

  constructor($scope, $injector) {
    super($scope, $injector);
    this.editorTabIndex = 1;

    if (!this.panel.targets) {
      this.panel.targets = [{}];
    }
  }

  initEditorTabs() {
    this.addEditorTab('Metrics', () => {
      return { templateUrl: 'public/app/partials/metrics.html' };
    });
  }

  refresh() {
    this.getData();
  }

  refreshData(data) {
    // null op
    return data;
  }

  loadSnapshot(data) {
    // null op
    return data;
  }

  getData() {
    if (this.otherPanelInFullscreenMode()) { return; }

    if (this.panel.snapshotData) {
      if (this.loadSnapshot) {
        this.loadSnapshot(this.panel.snapshotData);
      }
      return;
    }

    delete this.error;
    this.loading = true;

    this.datasourceSrv.get(this.panel.datasource).then(datasource => {
      this.datasource = datasource;
      return this.refreshData(this.datasource) || this.$q.when({});
    }).then(() => {
      this.loading = false;
    }, err => {
      console.log('Panel data error:', err);
      this.loading = false;
      this.error = err.message || "Timeseries data request error";
      this.inspector = {error: err};
    });
  }
}

export {MetricsPanelCtrl};

