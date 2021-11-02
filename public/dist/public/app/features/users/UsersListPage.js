import { __assign, __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { renderMarkdown } from '@grafana/data';
import { HorizontalGroup, Pagination, VerticalGroup } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import UsersActionBar from './UsersActionBar';
import UsersTable from './UsersTable';
import InviteesTable from './InviteesTable';
import { loadInvitees, loadUsers, removeUser, updateUser } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getInvitees, getUsers, getUsersSearchQuery, getUsersSearchPage } from './state/selectors';
import { setUsersSearchQuery, setUsersSearchPage } from './state/reducers';
function mapStateToProps(state) {
    return {
        navModel: getNavModel(state.navIndex, 'users'),
        users: getUsers(state.users),
        searchQuery: getUsersSearchQuery(state.users),
        searchPage: getUsersSearchPage(state.users),
        invitees: getInvitees(state.users),
        externalUserMngInfo: state.users.externalUserMngInfo,
        hasFetched: state.users.hasFetched,
    };
}
var mapDispatchToProps = {
    loadUsers: loadUsers,
    loadInvitees: loadInvitees,
    setUsersSearchQuery: setUsersSearchQuery,
    setUsersSearchPage: setUsersSearchPage,
    updateUser: updateUser,
    removeUser: removeUser,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var pageLimit = 30;
var UsersListPage = /** @class */ (function (_super) {
    __extends(UsersListPage, _super);
    function UsersListPage(props) {
        var _this = _super.call(this, props) || this;
        _this.onRoleChange = function (role, user) {
            var updatedUser = __assign(__assign({}, user), { role: role });
            _this.props.updateUser(updatedUser);
        };
        _this.onShowInvites = function () {
            _this.setState(function (prevState) { return ({
                showInvites: !prevState.showInvites,
            }); });
        };
        _this.getPaginatedUsers = function (users) {
            var offset = (_this.props.searchPage - 1) * pageLimit;
            return users.slice(offset, offset + pageLimit);
        };
        if (_this.props.externalUserMngInfo) {
            _this.externalUserMngInfoHtml = renderMarkdown(_this.props.externalUserMngInfo);
        }
        _this.state = {
            showInvites: false,
        };
        return _this;
    }
    UsersListPage.prototype.componentDidMount = function () {
        this.fetchUsers();
        this.fetchInvitees();
    };
    UsersListPage.prototype.fetchUsers = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.props.loadUsers()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    UsersListPage.prototype.fetchInvitees = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.props.loadInvitees()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    UsersListPage.prototype.renderTable = function () {
        var _this = this;
        var _a = this.props, invitees = _a.invitees, users = _a.users, setUsersSearchPage = _a.setUsersSearchPage;
        var paginatedUsers = this.getPaginatedUsers(users);
        var totalPages = Math.ceil(users.length / pageLimit);
        if (this.state.showInvites) {
            return React.createElement(InviteesTable, { invitees: invitees });
        }
        else {
            return (React.createElement(VerticalGroup, { spacing: "md" },
                React.createElement(UsersTable, { users: paginatedUsers, onRoleChange: function (role, user) { return _this.onRoleChange(role, user); }, onRemoveUser: function (user) { return _this.props.removeUser(user.userId); } }),
                React.createElement(HorizontalGroup, { justify: "flex-end" },
                    React.createElement(Pagination, { onNavigate: setUsersSearchPage, currentPage: this.props.searchPage, numberOfPages: totalPages, hideWhenSinglePage: true }))));
        }
    };
    UsersListPage.prototype.render = function () {
        var _a = this.props, navModel = _a.navModel, hasFetched = _a.hasFetched;
        var externalUserMngInfoHtml = this.externalUserMngInfoHtml;
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: !hasFetched },
                React.createElement(React.Fragment, null,
                    React.createElement(UsersActionBar, { onShowInvites: this.onShowInvites, showInvites: this.state.showInvites }),
                    externalUserMngInfoHtml && (React.createElement("div", { className: "grafana-info-box", dangerouslySetInnerHTML: { __html: externalUserMngInfoHtml } })),
                    hasFetched && this.renderTable()))));
    };
    return UsersListPage;
}(PureComponent));
export { UsersListPage };
export default connector(UsersListPage);
//# sourceMappingURL=UsersListPage.js.map