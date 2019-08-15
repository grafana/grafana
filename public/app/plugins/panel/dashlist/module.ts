import _ from 'lodash';
import { PanelCtrl } from 'app/plugins/sdk';
import impressionSrv from 'app/core/services/impression_srv';
import { auto } from 'angular';
import { BackendSrv } from 'app/core/services/backend_srv';
import { DashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

class DashListCtrl extends PanelCtrl {
  static templateUrl = 'module.html';
  static scrollable = true;

  groups: any[];
  modes: any[];

  panelDefaults: any = {
    query: '',
    limit: 10,
    tags: [],
    recent: false,
    search: false,
    starred: true,
    headings: true,
    folderId: null,
  };

  /** @ngInject */
  constructor(
    $scope: any,
    $injector: auto.IInjectorService,
    private backendSrv: BackendSrv,
    private dashboardSrv: DashboardSrv
  ) {
    super($scope, $injector);
    _.defaults(this.panel, this.panelDefaults);

    if (this.panel.tag) {
      this.panel.tags = [this.panel.tag];
      delete this.panel.tag;
    }

    this.events.on('refresh', this.onRefresh.bind(this));
    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));

    this.groups = [
      { list: [], show: false, header: 'Starred dashboards' },
      { list: [], show: false, header: 'Recently viewed dashboards' },
      { list: [], show: false, header: 'Search' },
    ];

    // update capability
    if (this.panel.mode) {
      if (this.panel.mode === 'starred') {
        this.panel.starred = true;
        this.panel.headings = false;
      }
      if (this.panel.mode === 'recently viewed') {
        this.panel.recent = true;
        this.panel.starred = false;
        this.panel.headings = false;
      }
      if (this.panel.mode === 'search') {
        this.panel.search = true;
        this.panel.starred = false;
        this.panel.headings = false;
      }
      delete this.panel.mode;
    }
  }

  onInitEditMode() {
    this.modes = ['starred', 'search', 'recently viewed'];
    this.addEditorTab('Options', 'public/app/plugins/panel/dashlist/editor.html');
  }

  onRefresh() {
    const promises = [];

    promises.push(this.getRecentDashboards());
    promises.push(this.getStarred());
    promises.push(this.getSearch());

    return Promise.all(promises).then(this.renderingCompleted.bind(this));
  }

  getSearch() {
    this.groups[2].show = this.panel.search;
    if (!this.panel.search) {
      return Promise.resolve();
    }

    const params = {
      limit: this.panel.limit,
      query: this.panel.query,
      tag: this.panel.tags,
      folderIds: this.panel.folderId,
      type: 'dash-db',
    };

    return this.backendSrv.search(params).then(result => {
      this.groups[2].list = result;
    });
  }

  getStarred() {
    this.groups[0].show = this.panel.starred;
    if (!this.panel.starred) {
      return Promise.resolve();
    }

    const params = { limit: this.panel.limit, starred: 'true' };
    return this.backendSrv.search(params).then(result => {
      this.groups[0].list = result;
    });
  }

  starDashboard(dash: any, evt: any) {
    this.dashboardSrv.starDashboard(dash.id, dash.isStarred).then((newState: any) => {
      dash.isStarred = newState;
    });

    if (evt) {
      evt.stopPropagation();
      evt.preventDefault();
    }
  }

  getRecentDashboards() {
    this.groups[1].show = this.panel.recent;
    if (!this.panel.recent) {
      return Promise.resolve();
    }

    const dashIds = _.take(impressionSrv.getDashboardOpened(), this.panel.limit);
    return this.backendSrv.search({ dashboardIds: dashIds, limit: this.panel.limit }).then(result => {
      this.groups[1].list = dashIds
        .map(orderId => {
          return _.find(result, dashboard => {
            return dashboard.id === orderId;
          });
        })
        .filter(el => {
          return el !== undefined;
        });
    });
  }

  onFolderChange(folder: any) {
    this.panel.folderId = folder.id;
    this.refresh();
  }
}

export { DashListCtrl, DashListCtrl as PanelCtrl };
