import { css, cx } from '@emotion/css';
import React from 'react';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Button, LoadingPlaceholder, Modal, ModalsController, useStyles2 } from '@grafana/ui/src';
import { generatePublicDashboardConfigUrl, generatePublicDashboardUrl, } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { useGetActiveUserDashboardsQuery } from '../../dashboard/api/publicDashboardApi';
const selectors = e2eSelectors.pages.UserListPage.UsersListPublicDashboardsPage.DashboardsListModal;
export const DashboardsListModal = ({ email, onDismiss }) => {
    const styles = useStyles2(getStyles);
    const { data: dashboards, isLoading } = useGetActiveUserDashboardsQuery(email);
    return (React.createElement(Modal, { className: styles.modal, isOpen: true, title: "Public dashboards", onDismiss: onDismiss }, isLoading ? (React.createElement("div", { className: styles.loading },
        React.createElement(LoadingPlaceholder, { text: "Loading..." }))) : (dashboards === null || dashboards === void 0 ? void 0 : dashboards.map((dash) => (React.createElement("div", { key: dash.dashboardUid, className: styles.listItem, "data-testid": selectors.listItem(dash.dashboardUid) },
        React.createElement("p", { className: styles.dashboardTitle }, dash.dashboardTitle),
        React.createElement("div", { className: styles.urlsContainer },
            React.createElement("a", { rel: "noreferrer", target: "_blank", className: cx('external-link', styles.url), href: generatePublicDashboardUrl(dash.publicDashboardAccessToken), onClick: onDismiss }, "Public dashboard URL"),
            React.createElement("span", { className: styles.urlsDivider }, "\u2022"),
            React.createElement("a", { className: cx('external-link', styles.url), href: generatePublicDashboardConfigUrl(dash.dashboardUid), onClick: onDismiss }, "Public dashboard settings")),
        React.createElement("hr", { className: styles.divider })))))));
};
export const DashboardsListModalButton = ({ email }) => (React.createElement(ModalsController, null, ({ showModal, hideModal }) => (React.createElement(Button, { variant: "secondary", size: "sm", icon: "question-circle", title: "Open dashboards list", "aria-label": "Open dashboards list", onClick: () => showModal(DashboardsListModal, { email, onDismiss: hideModal }) }))));
const getStyles = (theme) => ({
    modal: css `
    width: 590px;
  `,
    loading: css `
    display: flex;
    justify-content: center;
  `,
    listItem: css `
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(0.5)};
  `,
    divider: css `
    margin: ${theme.spacing(1.5, 0)};
    color: ${theme.colors.text.secondary};
  `,
    urlsContainer: css `
    display: flex;
    gap: ${theme.spacing(0.5)};

    ${theme.breakpoints.down('sm')} {
      flex-direction: column;
    }
  `,
    urlsDivider: css `
    color: ${theme.colors.text.secondary};
    ${theme.breakpoints.down('sm')} {
      display: none;
    }
  `,
    dashboardTitle: css `
    font-size: ${theme.typography.body.fontSize};
    font-weight: ${theme.typography.fontWeightBold};
    margin-bottom: 0;
  `,
    url: css `
    font-size: ${theme.typography.body.fontSize};
  `,
});
//# sourceMappingURL=DashboardsListModalButton.js.map