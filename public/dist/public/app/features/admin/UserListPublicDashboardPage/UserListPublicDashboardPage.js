import React from 'react';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { HorizontalGroup, Icon, Tag, Tooltip } from '@grafana/ui/src';
import { Page } from 'app/core/components/Page/Page';
import { useGetActiveUsersQuery } from '../../dashboard/api/publicDashboardApi';
import { DashboardsListModalButton } from './DashboardsListModalButton';
import { DeleteUserModalButton } from './DeleteUserModalButton';
const selectors = e2eSelectors.pages.UserListPage.publicDashboards;
export const UserListPublicDashboardPage = () => {
    const { data: users, isLoading } = useGetActiveUsersQuery();
    return (React.createElement(Page.Contents, { isLoading: isLoading },
        React.createElement("table", { className: "filter-table form-inline", "data-testid": selectors.container },
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null, "Email"),
                    React.createElement("th", null,
                        React.createElement("span", null, "Activated "),
                        React.createElement(Tooltip, { placement: "top", content: 'Earliest time user has been an active user to a dashboard' },
                            React.createElement(Icon, { name: "question-circle" }))),
                    React.createElement("th", null, "Origin"),
                    React.createElement("th", null, "Role"),
                    React.createElement("th", null))),
            React.createElement("tbody", null, users === null || users === void 0 ? void 0 : users.map((user) => (React.createElement("tr", { key: user.email },
                React.createElement("td", { className: "max-width-10" },
                    React.createElement("span", { className: "ellipsis", title: user.email }, user.email)),
                React.createElement("td", { className: "max-width-10" }, user.firstSeenAtAge),
                React.createElement("td", { className: "max-width-10" },
                    React.createElement(HorizontalGroup, { spacing: "sm" },
                        React.createElement("span", null,
                            user.totalDashboards,
                            " dashboard(s)"),
                        React.createElement(DashboardsListModalButton, { email: user.email }))),
                React.createElement("td", { className: "max-width-10" },
                    React.createElement(Tag, { name: "Viewer", colorIndex: 19 })),
                React.createElement("td", { className: "text-right" },
                    React.createElement(DeleteUserModalButton, { user: user })))))))));
};
//# sourceMappingURL=UserListPublicDashboardPage.js.map