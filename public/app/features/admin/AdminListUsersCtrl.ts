import { BackendSrv } from 'app/core/services/backend_srv';
import { NavModelSrv } from 'app/core/core';
import tags from 'app/core/utils/tags';

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
    this.users.forEach(user => {
      const authModuleLabel = this.getAuthLabel(user);
      const labelStyle = this.getAuthLabelStyle(authModuleLabel);
      user.authLabel = authModuleLabel;
      user.authLabelStyle = labelStyle;
    });
  }

  getAuthModule(user: any) {
    if (user.authModule && user.authModule.length) {
      return user.authModule[0];
    }
    return undefined;
  }

  getAuthLabel(user: any) {
    const authModule = this.getAuthModule(user);

    switch (authModule) {
      case 'ldap':
        return 'LDAP';
      case 'oauth_github':
        return 'GitHub';
      case 'oauth_google':
        return 'Google';
      case 'oauth_gitlab':
        return 'GitLab';
      case 'oauth_grafana_com':
      case 'oauth_grafananet':
        return 'grafana.com';
      case 'oauth_generic_oauth':
        return 'OAuth';
      default:
        return undefined;
    }
  }

  getAuthLabelStyle(label: string) {
    if (label === 'LDAP' || !label) {
      return {};
    }

    const { color, borderColor } = tags.getTagColorsFromName(label);
    return {
      'background-color': color,
      'border-color': borderColor,
    };
  }
}
