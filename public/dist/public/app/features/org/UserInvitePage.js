import React from 'react';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import UserInviteForm from './UserInviteForm';
export function UserInvitePage() {
    const subTitle = (React.createElement(React.Fragment, null,
        "Send invitation or add existing Grafana user to the organization.",
        React.createElement("span", { className: "highlight-word" },
            " ",
            contextSrv.user.orgName)));
    return (React.createElement(Page, { navId: "global-users", pageNav: { text: 'Invite user' }, subTitle: subTitle },
        React.createElement(Page.Contents, null,
            React.createElement(UserInviteForm, null))));
}
export default UserInvitePage;
//# sourceMappingURL=UserInvitePage.js.map