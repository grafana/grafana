import { __makeTemplateObject, __read } from "tslib";
import React, { useEffect, useState } from 'react';
import { css } from '@emotion/css';
import { CardContainer, LinkButton, useStyles2 } from '@grafana/ui';
import { AccessControlAction } from 'app/types';
import { getServerStats } from './state/apis';
import { contextSrv } from '../../core/services/context_srv';
import { Loader } from '../plugins/admin/components/Loader';
export var ServerStats = function () {
    var _a = __read(useState(null), 2), stats = _a[0], setStats = _a[1];
    var _b = __read(useState(false), 2), isLoading = _b[0], setIsLoading = _b[1];
    var styles = useStyles2(getStyles);
    useEffect(function () {
        if (contextSrv.hasAccess(AccessControlAction.ActionServerStatsRead, contextSrv.isGrafanaAdmin)) {
            setIsLoading(true);
            getServerStats().then(function (stats) {
                setStats(stats);
                setIsLoading(false);
            });
        }
    }, []);
    if (!contextSrv.hasAccess(AccessControlAction.ActionServerStatsRead, contextSrv.isGrafanaAdmin)) {
        return null;
    }
    return (React.createElement(React.Fragment, null,
        React.createElement("h2", { className: styles.title }, "Instance statistics"),
        isLoading ? (React.createElement("div", { className: styles.loader },
            React.createElement(Loader, { text: 'Loading instance stats...' }))) : stats ? (React.createElement("div", { className: styles.row },
            React.createElement(StatCard, { content: [
                    { name: 'Dashboards (starred)', value: stats.dashboards + " (" + stats.stars + ")" },
                    { name: 'Tags', value: stats.tags },
                    { name: 'Playlists', value: stats.playlists },
                    { name: 'Snapshots', value: stats.snapshots },
                ], footer: React.createElement(LinkButton, { href: '/dashboards', variant: 'secondary' }, "Manage dashboards") }),
            React.createElement("div", { className: styles.doubleRow },
                React.createElement(StatCard, { content: [{ name: 'Data sources', value: stats.datasources }], footer: React.createElement(LinkButton, { href: '/datasources', variant: 'secondary' }, "Manage data sources") }),
                React.createElement(StatCard, { content: [{ name: 'Alerts', value: stats.alerts }], footer: React.createElement(LinkButton, { href: '/alerting/list', variant: 'secondary' }, "Alerts") })),
            React.createElement(StatCard, { content: [
                    { name: 'Organisations', value: stats.orgs },
                    { name: 'Users total', value: stats.users },
                    { name: 'Active users in last 30 days', value: stats.activeUsers },
                    { name: 'Active sessions', value: stats.activeSessions },
                ], footer: React.createElement(LinkButton, { href: '/admin/users', variant: 'secondary' }, "Manage users") }))) : (React.createElement("p", { className: styles.notFound }, "No stats found."))));
};
var getStyles = function (theme) {
    return {
        title: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing(4)),
        row: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      justify-content: space-between;\n      width: 100%;\n\n      & > div:not(:last-of-type) {\n        margin-right: ", ";\n      }\n\n      & > div {\n        width: 33.3%;\n      }\n    "], ["\n      display: flex;\n      justify-content: space-between;\n      width: 100%;\n\n      & > div:not(:last-of-type) {\n        margin-right: ", ";\n      }\n\n      & > div {\n        width: 33.3%;\n      }\n    "])), theme.spacing(2)),
        doubleRow: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n\n      & > div:first-of-type {\n        margin-bottom: ", ";\n      }\n    "], ["\n      display: flex;\n      flex-direction: column;\n\n      & > div:first-of-type {\n        margin-bottom: ", ";\n      }\n    "])), theme.spacing(2)),
        loader: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      height: 290px;\n    "], ["\n      height: 290px;\n    "]))),
        notFound: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      font-size: ", ";\n      text-align: center;\n      height: 290px;\n    "], ["\n      font-size: ", ";\n      text-align: center;\n      height: 290px;\n    "])), theme.typography.h6.fontSize),
    };
};
var StatCard = function (_a) {
    var content = _a.content, footer = _a.footer;
    var styles = useStyles2(getCardStyles);
    return (React.createElement(CardContainer, { className: styles.container, disableHover: true },
        React.createElement("div", { className: styles.inner },
            React.createElement("div", { className: styles.content }, content.map(function (item) {
                return (React.createElement("div", { key: item.name, className: styles.row },
                    React.createElement("span", null, item.name),
                    React.createElement("span", null, item.value)));
            })),
            footer && React.createElement("div", null, footer))));
};
var getCardStyles = function (theme) {
    return {
        container: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      padding: ", ";\n    "], ["\n      padding: ", ";\n    "])), theme.spacing(2)),
        inner: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      width: 100%;\n    "], ["\n      display: flex;\n      flex-direction: column;\n      width: 100%;\n    "]))),
        content: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      flex: 1 0 auto;\n    "], ["\n      flex: 1 0 auto;\n    "]))),
        row: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      display: flex;\n      justify-content: space-between;\n      width: 100%;\n      margin-bottom: ", ";\n      align-items: center;\n    "], ["\n      display: flex;\n      justify-content: space-between;\n      width: 100%;\n      margin-bottom: ", ";\n      align-items: center;\n    "])), theme.spacing(2)),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9;
//# sourceMappingURL=ServerStats.js.map