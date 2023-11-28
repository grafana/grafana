import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { useMedia } from 'react-use';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { reportInteraction } from '@grafana/runtime';
import { LinkButton, useStyles2, Spinner, Card, useTheme2, Tooltip, Icon, Switch, Pagination, HorizontalGroup, } from '@grafana/ui/src';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { useListPublicDashboardsQuery, useUpdatePublicDashboardMutation, } from 'app/features/dashboard/api/publicDashboardApi';
import { generatePublicDashboardConfigUrl, generatePublicDashboardUrl, } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { AccessControlAction } from 'app/types';
import { DeletePublicDashboardButton } from './DeletePublicDashboardButton';
const PublicDashboardCard = ({ pd }) => {
    const styles = useStyles2(getStyles);
    const theme = useTheme2();
    const isMobile = useMedia(`(max-width: ${theme.breakpoints.values.sm}px)`);
    const [update, { isLoading: isUpdateLoading }] = useUpdatePublicDashboardMutation();
    const selectors = e2eSelectors.pages.PublicDashboards;
    const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);
    const isOrphaned = !pd.dashboardUid;
    const onTogglePause = (pd, isPaused) => {
        const req = {
            dashboard: { uid: pd.dashboardUid },
            payload: {
                uid: pd.uid,
                isEnabled: !isPaused,
            },
        };
        update(req);
    };
    const CardActions = useMemo(() => (isMobile ? Card.Actions : Card.SecondaryActions), [isMobile]);
    return (React.createElement(Card, { className: styles.card, href: !isOrphaned ? `/d/${pd.dashboardUid}` : undefined },
        React.createElement(Card.Heading, { className: styles.heading }, !isOrphaned ? (React.createElement("span", null, pd.title)) : (React.createElement(Tooltip, { content: "The linked dashboard has already been deleted", placement: "top" },
            React.createElement("div", { className: styles.orphanedTitle },
                React.createElement("span", null, "Orphaned public dashboard"),
                React.createElement(Icon, { name: "info-circle" }))))),
        React.createElement(CardActions, { className: styles.actions },
            React.createElement("div", { className: styles.pauseSwitch },
                React.createElement(Switch, { value: !pd.isEnabled, label: "Pause sharing", disabled: isUpdateLoading, onChange: (e) => {
                        reportInteraction('grafana_dashboards_public_enable_clicked', {
                            action: e.currentTarget.checked ? 'disable' : 'enable',
                        });
                        onTogglePause(pd, e.currentTarget.checked);
                    }, "data-testid": selectors.ListItem.pauseSwitch }),
                React.createElement("span", null, "Pause sharing")),
            React.createElement(LinkButton, { disabled: isOrphaned, fill: "text", icon: "external-link-alt", variant: "secondary", target: "_blank", color: theme.colors.warning.text, href: generatePublicDashboardUrl(pd.accessToken), key: "public-dashboard-url", tooltip: "View public dashboard", "data-testid": selectors.ListItem.linkButton }),
            React.createElement(LinkButton, { disabled: isOrphaned, fill: "text", icon: "cog", variant: "secondary", color: theme.colors.warning.text, href: generatePublicDashboardConfigUrl(pd.dashboardUid), key: "public-dashboard-config-url", tooltip: "Configure public dashboard", "data-testid": selectors.ListItem.configButton }),
            hasWritePermissions && (React.createElement(DeletePublicDashboardButton, { fill: "text", icon: "trash-alt", variant: "secondary", publicDashboard: pd, tooltip: "Revoke public dashboard url", loader: React.createElement(Spinner, null), "data-testid": selectors.ListItem.trashcanButton })))));
};
export const PublicDashboardListTable = () => {
    const [page, setPage] = useState(1);
    const styles = useStyles2(getStyles);
    const { data: paginatedPublicDashboards, isLoading, isFetching, isError } = useListPublicDashboardsQuery(page);
    return (React.createElement(Page, { navId: "dashboards/public", actions: isFetching && React.createElement(Spinner, null) },
        React.createElement(Page.Contents, { isLoading: isLoading }, !isLoading && !isError && !!paginatedPublicDashboards && (React.createElement("div", null,
            React.createElement("ul", { className: styles.list }, paginatedPublicDashboards.publicDashboards.map((pd) => (React.createElement("li", { key: pd.uid },
                React.createElement(PublicDashboardCard, { pd: pd }))))),
            React.createElement(HorizontalGroup, { justify: "flex-end" },
                React.createElement(Pagination, { onNavigate: setPage, currentPage: paginatedPublicDashboards.page, numberOfPages: paginatedPublicDashboards.totalPages, hideWhenSinglePage: true })))))));
};
const getStyles = (theme) => ({
    list: css `
    list-style-type: none;
    margin-bottom: ${theme.spacing(2)};
  `,
    card: css `
    ${theme.breakpoints.up('sm')} {
      display: flex;
    }
  `,
    heading: css `
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
    flex: 1;
  `,
    orphanedTitle: css `
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
  `,
    actions: css `
    display: flex;
    align-items: center;
    position: relative;

    gap: ${theme.spacing(0.5)};
    ${theme.breakpoints.up('sm')} {
      gap: ${theme.spacing(1)};
    }
  `,
    pauseSwitch: css `
    display: flex;
    gap: ${theme.spacing(1)};
    align-items: center;
    font-size: ${theme.typography.bodySmall.fontSize};
    margin-bottom: 0;
    flex: 1;

    ${theme.breakpoints.up('sm')} {
      padding-right: ${theme.spacing(2)};
    }
  `,
});
//# sourceMappingURL=PublicDashboardListTable.js.map