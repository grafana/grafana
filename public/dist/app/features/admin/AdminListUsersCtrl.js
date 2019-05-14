var AdminListUsersCtrl = /** @class */ (function () {
    /** @ngInject */
    function AdminListUsersCtrl($scope, backendSrv, navModelSrv) {
        this.$scope = $scope;
        this.backendSrv = backendSrv;
        this.pages = [];
        this.perPage = 50;
        this.page = 1;
        this.showPaging = false;
        this.navModel = navModelSrv.getNav('admin', 'global-users', 0);
        this.query = '';
        this.getUsers();
    }
    AdminListUsersCtrl.prototype.getUsers = function () {
        var _this = this;
        this.backendSrv
            .get("/api/users/search?perpage=" + this.perPage + "&page=" + this.page + "&query=" + this.query)
            .then(function (result) {
            _this.users = result.users;
            _this.page = result.page;
            _this.perPage = result.perPage;
            _this.totalPages = Math.ceil(result.totalCount / result.perPage);
            _this.showPaging = _this.totalPages > 1;
            _this.pages = [];
            for (var i = 1; i < _this.totalPages + 1; i++) {
                _this.pages.push({ page: i, current: i === _this.page });
            }
        });
    };
    AdminListUsersCtrl.prototype.navigateToPage = function (page) {
        this.page = page.page;
        this.getUsers();
    };
    AdminListUsersCtrl.prototype.deleteUser = function (user) {
        var _this = this;
        this.$scope.appEvent('confirm-modal', {
            title: 'Delete',
            text: 'Do you want to delete ' + user.login + '?',
            icon: 'fa-trash',
            yesText: 'Delete',
            onConfirm: function () {
                _this.backendSrv.delete('/api/admin/users/' + user.id).then(function () {
                    _this.getUsers();
                });
            },
        });
    };
    return AdminListUsersCtrl;
}());
export default AdminListUsersCtrl;
//# sourceMappingURL=AdminListUsersCtrl.js.map