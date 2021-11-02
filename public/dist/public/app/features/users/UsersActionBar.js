import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { setUsersSearchQuery } from './state/reducers';
import { getInviteesCount, getUsersSearchQuery } from './state/selectors';
import { RadioButtonGroup, LinkButton, FilterInput } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
var UsersActionBar = /** @class */ (function (_super) {
    __extends(UsersActionBar, _super);
    function UsersActionBar() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    UsersActionBar.prototype.render = function () {
        var _a = this.props, canInvite = _a.canInvite, externalUserMngLinkName = _a.externalUserMngLinkName, externalUserMngLinkUrl = _a.externalUserMngLinkUrl, searchQuery = _a.searchQuery, pendingInvitesCount = _a.pendingInvitesCount, setUsersSearchQuery = _a.setUsersSearchQuery, onShowInvites = _a.onShowInvites, showInvites = _a.showInvites;
        var options = [
            { label: 'Users', value: 'users' },
            { label: "Pending Invites (" + pendingInvitesCount + ")", value: 'invites' },
        ];
        var canAddToOrg = contextSrv.hasPermission(AccessControlAction.OrgUsersAdd);
        return (React.createElement("div", { className: "page-action-bar" },
            React.createElement("div", { className: "gf-form gf-form--grow" },
                React.createElement(FilterInput, { value: searchQuery, onChange: setUsersSearchQuery, placeholder: "Search user by login, email or name" })),
            pendingInvitesCount > 0 && (React.createElement("div", { style: { marginLeft: '1rem' } },
                React.createElement(RadioButtonGroup, { value: showInvites ? 'invites' : 'users', options: options, onChange: onShowInvites }))),
            canInvite && canAddToOrg && React.createElement(LinkButton, { href: "org/users/invite" }, "Invite"),
            externalUserMngLinkUrl && (React.createElement(LinkButton, { href: externalUserMngLinkUrl, target: "_blank", rel: "noopener" }, externalUserMngLinkName))));
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