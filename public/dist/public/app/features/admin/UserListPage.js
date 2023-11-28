import { css } from '@emotion/css';
import React, { useState } from 'react';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config, featureEnabled } from '@grafana/runtime';
import { useStyles2, TabsBar, Tab } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { Page } from '../../core/components/Page/Page';
import { AccessControlAction } from '../../types';
import { UsersListPageContent } from '../users/UsersListPage';
import { UserListAdminPageContent } from './UserListAdminPage';
import { UserListPublicDashboardPage } from './UserListPublicDashboardPage/UserListPublicDashboardPage';
var TabView;
(function (TabView) {
    TabView["ADMIN"] = "admin";
    TabView["ORG"] = "org";
    TabView["PUBLIC_DASHBOARDS"] = "public-dashboards";
})(TabView || (TabView = {}));
const selectors = e2eSelectors.pages.UserListPage;
const PublicDashboardsTab = ({ view, setView }) => (React.createElement(Tab, { label: "Public dashboard users", active: view === TabView.PUBLIC_DASHBOARDS, onChangeTab: () => setView(TabView.PUBLIC_DASHBOARDS), "data-testid": selectors.tabs.publicDashboardsUsers }));
const TAB_PAGE_MAP = {
    [TabView.ADMIN]: React.createElement(UserListAdminPageContent, null),
    [TabView.ORG]: React.createElement(UsersListPageContent, null),
    [TabView.PUBLIC_DASHBOARDS]: React.createElement(UserListPublicDashboardPage, null),
};
export default function UserListPage() {
    const styles = useStyles2(getStyles);
    const hasAccessToAdminUsers = contextSrv.hasPermission(AccessControlAction.UsersRead);
    const hasAccessToOrgUsers = contextSrv.hasPermission(AccessControlAction.OrgUsersRead);
    const hasEmailSharingEnabled = Boolean(config.featureToggles.publicDashboards) &&
        Boolean(config.featureToggles.publicDashboardsEmailSharing) &&
        featureEnabled('publicDashboardsEmailSharing');
    const [view, setView] = useState(() => {
        if (hasAccessToAdminUsers) {
            return TabView.ADMIN;
        }
        else if (hasAccessToOrgUsers) {
            return TabView.ORG;
        }
        return null;
    });
    const showAdminAndOrgTabs = hasAccessToOrgUsers && hasAccessToAdminUsers;
    return (React.createElement(Page, { navId: 'global-users' },
        showAdminAndOrgTabs ? (React.createElement(TabsBar, { className: styles.tabsMargin },
            React.createElement(Tab, { label: "All users", active: view === TabView.ADMIN, onChangeTab: () => setView(TabView.ADMIN), "data-testid": selectors.tabs.allUsers }),
            React.createElement(Tab, { label: "Organization users", active: view === TabView.ORG, onChangeTab: () => setView(TabView.ORG), "data-testid": selectors.tabs.orgUsers }),
            hasEmailSharingEnabled && React.createElement(PublicDashboardsTab, { view: view, setView: setView }))) : (hasEmailSharingEnabled && (React.createElement(TabsBar, { className: styles.tabsMargin },
            React.createElement(Tab, { label: "Users", active: view === TabView.ORG, onChangeTab: () => setView(TabView.ORG), "data-testid": selectors.tabs.users }),
            React.createElement(PublicDashboardsTab, { view: view, setView: setView })))),
        view ? TAB_PAGE_MAP[view] : React.createElement(UsersListPageContent, null)));
}
const getStyles = (theme) => ({
    tabsMargin: css({
        marginBottom: theme.spacing(3),
    }),
});
//# sourceMappingURL=UserListPage.js.map