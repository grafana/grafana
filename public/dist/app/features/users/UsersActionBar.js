import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import { setUsersSearchQuery } from './state/actions';
import { getInviteesCount, getUsersSearchQuery } from './state/selectors';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
var UsersActionBar = /** @class */ (function (_super) {
    tslib_1.__extends(UsersActionBar, _super);
    function UsersActionBar() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    UsersActionBar.prototype.render = function () {
        var _a = this.props, canInvite = _a.canInvite, externalUserMngLinkName = _a.externalUserMngLinkName, externalUserMngLinkUrl = _a.externalUserMngLinkUrl, searchQuery = _a.searchQuery, pendingInvitesCount = _a.pendingInvitesCount, setUsersSearchQuery = _a.setUsersSearchQuery, onShowInvites = _a.onShowInvites, showInvites = _a.showInvites;
        var pendingInvitesButtonStyle = classNames({
            btn: true,
            'toggle-btn': true,
            active: showInvites,
        });
        var usersButtonStyle = classNames({
            btn: true,
            'toggle-btn': true,
            active: !showInvites,
        });
        return (React.createElement("div", { className: "page-action-bar" },
            React.createElement("div", { className: "gf-form gf-form--grow" },
                React.createElement(FilterInput, { labelClassName: "gf-form--has-input-icon", inputClassName: "gf-form-input width-20", value: searchQuery, onChange: setUsersSearchQuery, placeholder: "Filter by name or type" }),
                pendingInvitesCount > 0 && (React.createElement("div", { style: { marginLeft: '1rem' } },
                    React.createElement("button", { className: usersButtonStyle, key: "users", onClick: onShowInvites }, "Users"),
                    React.createElement("button", { className: pendingInvitesButtonStyle, onClick: onShowInvites, key: "pending-invites" },
                        "Pending Invites (",
                        pendingInvitesCount,
                        ")"))),
                React.createElement("div", { className: "page-action-bar__spacer" }),
                canInvite && (React.createElement("a", { className: "btn btn-primary", href: "org/users/invite" },
                    React.createElement("span", null, "Invite"))),
                externalUserMngLinkUrl && (React.createElement("a", { className: "btn btn-primary", href: externalUserMngLinkUrl, target: "_blank" },
                    React.createElement("i", { className: "fa fa-external-link-square" }),
                    " ",
                    externalUserMngLinkName)))));
    };
    return UsersActionBar;
}(PureComponent));
export { UsersActionBar };
function mapStateToProps(state) {
    return {
        searchQuery: getUsersSearchQuery(state.users),
        pendingInvitesCount: getInviteesCount(state.users),
        externalUserMngLinkName: state.users.externalUserMngLinkName,
        externalUserMngLinkUrl: state.users.externalUserMngLinkUrl,
        canInvite: state.users.canInvite,
    };
}
var mapDispatchToProps = {
    setUsersSearchQuery: setUsersSearchQuery,
};
export default connect(mapStateToProps, mapDispatchToProps)(UsersActionBar);
//# sourceMappingURL=UsersActionBar.js.map