export default class AdminListUsersCtrl {
  users: any;
  pages = [];
  perPage = 50;
  page = 1;
  totalPages: number;
  showPaging = false;
  query: any;
  navModel: any;

  /** @ngInject */
  constructor(private $scope, private backendSrv, navModelSrv) {
    this.navModel = navModelSrv.getNav('admin', 'global-users', 0);
    this.query = '';
    this.getUsers();
  }

  getUsers() {
    this.backendSrv
      .get(`/api/users/search?perpage=${this.perPage}&page=${this.page}&query=${this.query}`)
      .then(result => {
        this.users = result.users;
        this.page = result.page;
        this.perPage = result.perPage;
        this.totalPages = Math.ceil(result.totalCount / result.perPage);
        this.showPaging = this.totalPages > 1;
        this.pages = [];

        for (let i = 1; i < this.totalPages + 1; i++) {
          this.pages.push({ page: i, current: i === this.page });
        }
      });
  }

  navigateToPage(page) {
    this.page = page.page;
    this.getUsers();
  }

  deleteUser(user) {
    this.$scope.appEvent('confirm-modal', {
      title: 'Delete',
      text: 'Do you want to delete ' + user.login + '?',
      icon: 'fa-trash',
      yesText: 'Delete',
      onConfirm: () => {
        this.backendSrv.delete('/api/admin/users/' + user.id).then(() => {
          this.getUsers();
        });
      },
    });
  }
}
