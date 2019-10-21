import { getTagColorsFromName } from '@grafana/ui';
import { BackendSrv } from 'app/core/services/backend_srv';
import { NavModelSrv } from 'app/core/core';

export default class AdminListUsersCtrl {
  users: any;
  pages: any[] = [];
  perPage = 50;
  page = 1;
  totalPages: number;
  showPaging = false;
  query: any;
  navModel: any;

  /** @ngInject */
  constructor(private backendSrv: BackendSrv, navModelSrv: NavModelSrv) {
    this.navModel = navModelSrv.getNav('admin', 'global-users', 0);
    this.query = '';
    this.getUsers();
  }

  getUsers() {
    this.backendSrv
      .get(`/api/users/search?perpage=${this.perPage}&page=${this.page}&query=${this.query}`)
      .then((result: any) => {
        this.users = result.users;
        this.page = result.page;
        this.perPage = result.perPage;
        this.totalPages = Math.ceil(result.totalCount / result.perPage);
        this.showPaging = this.totalPages > 1;
        this.pages = [];

        for (let i = 1; i < this.totalPages + 1; i++) {
          this.pages.push({ page: i, current: i === this.page });
        }

        this.addUsersAuthLabels();
      });
  }

  navigateToPage(page: any) {
    this.page = page.page;
    this.getUsers();
  }

  addUsersAuthLabels() {
    for (const user of this.users) {
      user.authLabel = getAuthLabel(user);
      user.authLabelStyle = getAuthLabelStyle(user.authLabel);
    }
  }
}

function getAuthLabel(user: any) {
  if (user.authLabels && user.authLabels.length) {
    return user.authLabels[0];
  }
  return '';
}

function getAuthLabelStyle(label: string) {
  if (label === 'LDAP' || !label) {
    return {};
  }

  const { color, borderColor } = getTagColorsFromName(label);
  return {
    'background-color': color,
    'border-color': borderColor,
  };
}
