import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import Remarkable from 'remarkable';
import Page from 'app/core/components/Page/Page';
import UsersActionBar from './UsersActionBar';
import UsersTable from './UsersTable';
import InviteesTable from './InviteesTable';
import appEvents from 'app/core/app_events';
import { loadUsers, loadInvitees, setUsersSearchQuery, updateUser, removeUser } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getInvitees, getUsers, getUsersSearchQuery } from './state/selectors';
var UsersListPage = /** @class */ (function (_super) {
    tslib_1.__extends(UsersListPage, _super);
    function UsersListPage(props) {
        var _this = _super.call(this, props) || this;
        _this.onRoleChange = function (role, user) {
            var updatedUser = tslib_1.__assign({}, user, { role: role });
            _this.props.updateUser(updatedUser);
        };
        _this.onRemoveUser = function (user) {
            appEvents.emit('confirm-modal', {
                title: 'Delete',
                text: 'Are you sure you want to delete user ' + user.login + '?',
                yesText: 'Delete',
                icon: 'fa-warning',
                onConfirm: function () {
                    _this.props.removeUser(user.userId);
                },
            });
        };
        _this.onShowInvites = function () {
            _this.setState(function (prevState) { return ({
                showInvites: !prevState.showInvites,
            }); });
        };
        if (_this.props.externalUserMngInfo) {
            var markdownRenderer = new Remarkable();
            _this.externalUserMngInfoHtml = markdownRenderer.render(_this.props.externalUserMngInfo);
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
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.props.loadUsers()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    UsersListPage.prototype.fetchInvitees = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.props.loadInvitees()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    UsersListPage.prototype.renderTable = function () {
        var _this = this;
        var _a = this.props, invitees = _a.invitees, users = _a.users;
        if (this.state.showInvites) {
            return React.createElement(InviteesTable, { invitees: invitees });
        }
        else {
            return (React.createElement(UsersTable, { users: users, onRoleChange: function (role, user) { return _this.onRoleChange(role, user); }, onRemoveUser: function (user) { return _this.onRemoveUser(user); } }));
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
function mapStateToProps(state) {
    return {
        navModel: getNavModel(state.navIndex, 'users'),
        users: getUsers(state.users),
        searchQuery: getUsersSearchQuery(state.users),
        invitees: getInvitees(state.users),
        externalUserMngInfo: state.users.externalUserMngInfo,
        hasFetched: state.users.hasFetched,
    };
}
var mapDispatchToProps = {
    loadUsers: loadUsers,
    loadInvitees: loadInvitees,
    setUsersSearchQuery: setUsersSearchQuery,
    updateUser: updateUser,
    removeUser: removeUser,
};
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(UsersListPage));
//# sourceMappingURL=UsersListPage.js.map