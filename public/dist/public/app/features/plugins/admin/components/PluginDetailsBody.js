import { css, cx } from '@emotion/css';
import React from 'react';
import { PluginContextProvider } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { VersionList } from '../components/VersionList';
import { usePluginConfig } from '../hooks/usePluginConfig';
import { PluginTabIds } from '../types';
import { AppConfigCtrlWrapper } from './AppConfigWrapper';
import { PluginDashboards } from './PluginDashboards';
import { PluginUsage } from './PluginUsage';
export function PluginDetailsBody({ plugin, queryParams, pageId }) {
    var _a, _b, _c;
    const styles = useStyles2(getStyles);
    const { value: pluginConfig } = usePluginConfig(plugin);
    if (pageId === PluginTabIds.OVERVIEW) {
        return (React.createElement("div", { className: cx(styles.readme, styles.container), dangerouslySetInnerHTML: {
                __html: (_b = (_a = plugin.details) === null || _a === void 0 ? void 0 : _a.readme) !== null && _b !== void 0 ? _b : 'No plugin help or readme markdown file was found',
            } }));
    }
    if (pageId === PluginTabIds.VERSIONS) {
        return (React.createElement("div", { className: styles.container },
            React.createElement(VersionList, { versions: (_c = plugin.details) === null || _c === void 0 ? void 0 : _c.versions, installedVersion: plugin.installedVersion })));
    }
    if (pageId === PluginTabIds.CONFIG && (pluginConfig === null || pluginConfig === void 0 ? void 0 : pluginConfig.angularConfigCtrl)) {
        return (React.createElement("div", { className: styles.container },
            React.createElement(AppConfigCtrlWrapper, { app: pluginConfig })));
    }
    if (pluginConfig === null || pluginConfig === void 0 ? void 0 : pluginConfig.configPages) {
        for (const configPage of pluginConfig.configPages) {
            if (pageId === configPage.id) {
                return (React.createElement("div", { className: styles.container },
                    React.createElement(PluginContextProvider, { meta: pluginConfig.meta },
                        React.createElement(configPage.body, { plugin: pluginConfig, query: queryParams }))));
            }
        }
    }
    if (pageId === PluginTabIds.USAGE && pluginConfig) {
        return (React.createElement("div", { className: styles.container },
            React.createElement(PluginUsage, { plugin: pluginConfig === null || pluginConfig === void 0 ? void 0 : pluginConfig.meta })));
    }
    if (pageId === PluginTabIds.DASHBOARDS && pluginConfig) {
        return (React.createElement("div", { className: styles.container },
            React.createElement(PluginDashboards, { plugin: pluginConfig === null || pluginConfig === void 0 ? void 0 : pluginConfig.meta })));
    }
    return (React.createElement("div", { className: styles.container },
        React.createElement("p", null, "Page not found.")));
}
export const getStyles = (theme) => ({
    container: css ``,
    readme: css `
    & img {
      max-width: 100%;
    }

    h1,
    h2,
    h3 {
      margin-top: ${theme.spacing(3)};
      margin-bottom: ${theme.spacing(2)};
    }

    *:first-child {
      margin-top: 0;
    }

    li {
      margin-left: ${theme.spacing(2)};
      & > p {
        margin: ${theme.spacing()} 0;
      }
    }

    a {
      color: ${theme.colors.text.link};

      &:hover {
        color: ${theme.colors.text.link};
        text-decoration: underline;
      }
    }

    table {
      table-layout: fixed;
      width: 100%;

      td,
      th {
        overflow-x: auto;
        padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
      }

      table,
      th,
      td {
        border: 1px solid ${theme.colors.border.medium};
        border-collapse: collapse;
      }
    }
  `,
});
//# sourceMappingURL=PluginDetailsBody.js.map