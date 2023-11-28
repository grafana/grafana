import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { CardContainer, LinkButton, useStyles2 } from '@grafana/ui';
import { AccessControlAction } from 'app/types';
import { contextSrv } from '../../core/services/context_srv';
import { Loader } from '../plugins/admin/components/Loader';
import { getServerStats } from './state/apis';
export const ServerStats = () => {
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const styles = useStyles2(getStyles);
    const hasAccessToDataSources = contextSrv.hasPermission(AccessControlAction.DataSourcesRead);
    const hasAccessToAdminUsers = contextSrv.hasPermission(AccessControlAction.UsersRead);
    useEffect(() => {
        if (contextSrv.hasPermission(AccessControlAction.ActionServerStatsRead)) {
            setIsLoading(true);
            getServerStats().then((stats) => {
                setStats(stats);
                setIsLoading(false);
            });
        }
    }, []);
    if (!contextSrv.hasPermission(AccessControlAction.ActionServerStatsRead)) {
        return null;
    }
    return (React.createElement(React.Fragment, null,
        React.createElement("h2", { className: styles.title }, "Instance statistics"),
        isLoading ? (React.createElement("div", { className: styles.loader },
            React.createElement(Loader, { text: 'Loading instance stats...' }))) : stats ? (React.createElement("div", { className: styles.row },
            React.createElement(StatCard, { content: [
                    { name: 'Dashboards (starred)', value: `${stats.dashboards} (${stats.stars})` },
                    { name: 'Tags', value: stats.tags },
                    { name: 'Playlists', value: stats.playlists },
                    { name: 'Snapshots', value: stats.snapshots },
                ], footer: React.createElement(LinkButton, { href: '/dashboards', variant: 'secondary' }, "Manage dashboards") }),
            React.createElement("div", { className: styles.doubleRow },
                React.createElement(StatCard, { content: [{ name: 'Data sources', value: stats.datasources }], footer: hasAccessToDataSources && (React.createElement(LinkButton, { href: '/datasources', variant: 'secondary' }, "Manage data sources")) }),
                React.createElement(StatCard, { content: [{ name: 'Alerts', value: stats.alerts }], footer: React.createElement(LinkButton, { href: '/alerting/list', variant: 'secondary' }, "Alerts") })),
            React.createElement(StatCard, { content: [
                    { name: 'Organisations', value: stats.orgs },
                    { name: 'Users total', value: stats.users },
                    { name: 'Active users in last 30 days', value: stats.activeUsers },
                    { name: 'Active sessions', value: stats.activeSessions },
                ], footer: hasAccessToAdminUsers && (React.createElement(LinkButton, { href: '/admin/users', variant: 'secondary' }, "Manage users")) }))) : (React.createElement("p", { className: styles.notFound }, "No stats found."))));
};
const getStyles = (theme) => {
    return {
        title: css `
      margin-bottom: ${theme.spacing(4)};
    `,
        row: css `
      display: flex;
      justify-content: space-between;
      width: 100%;

      & > div:not(:last-of-type) {
        margin-right: ${theme.spacing(2)};
      }

      & > div {
        width: 33.3%;
      }
    `,
        doubleRow: css `
      display: flex;
      flex-direction: column;

      & > div:first-of-type {
        margin-bottom: ${theme.spacing(2)};
      }
    `,
        loader: css `
      height: 290px;
    `,
        notFound: css `
      font-size: ${theme.typography.h6.fontSize};
      text-align: center;
      height: 290px;
    `,
    };
};
const StatCard = ({ content, footer }) => {
    const styles = useStyles2(getCardStyles);
    return (React.createElement(CardContainer, { className: styles.container, disableHover: true },
        React.createElement("div", { className: styles.inner },
            React.createElement("div", { className: styles.content }, content.map((item) => {
                return (React.createElement("div", { key: item.name, className: styles.row },
                    React.createElement("span", null, item.name),
                    React.createElement("span", null, item.value)));
            })),
            footer && React.createElement("div", null, footer))));
};
const getCardStyles = (theme) => {
    return {
        container: css `
      padding: ${theme.spacing(2)};
    `,
        inner: css `
      display: flex;
      flex-direction: column;
      width: 100%;
    `,
        content: css `
      flex: 1 0 auto;
    `,
        row: css `
      display: flex;
      justify-content: space-between;
      width: 100%;
      margin-bottom: ${theme.spacing(2)};
      align-items: center;
    `,
    };
};
//# sourceMappingURL=ServerStats.js.map