import React from 'react';
import { connect } from 'react-redux';
import UserInviteForm from './UserInviteForm';
import { contextSrv } from 'app/core/core';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
export var UserInvitePage = function (_a) {
    var navModel = _a.navModel;
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            React.createElement("h3", { className: "page-sub-heading" }, "Invite user"),
            React.createElement("div", { className: "p-b-2" },
                "Send invitation or add existing Grafana user to the organization.",
                React.createElement("span", { className: "highlight-word" },
                    " ",
                    contextSrv.user.orgName)),
            React.createElement(UserInviteForm, null))));
};
var mapStateToProps = function (state) { return ({
    navModel: getNavModel(state.navIndex, 'users'),
}); };
export default connect(mapStateToProps)(UserInvitePage);
//# sourceMappingURL=UserInvitePage.js.map