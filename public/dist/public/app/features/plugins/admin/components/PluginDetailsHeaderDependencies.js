import { css } from '@emotion/css';
import React from 'react';
import { Stack } from '@grafana/experimental';
import { useStyles2, Icon } from '@grafana/ui';
import { PluginIconName } from '../types';
export function PluginDetailsHeaderDependencies({ plugin, latestCompatibleVersion, className, }) {
    var _a, _b, _c;
    const styles = useStyles2(getStyles);
    const pluginDependencies = (_a = plugin.details) === null || _a === void 0 ? void 0 : _a.pluginDependencies;
    const grafanaDependency = plugin.isInstalled
        ? (_b = plugin.details) === null || _b === void 0 ? void 0 : _b.grafanaDependency
        : (latestCompatibleVersion === null || latestCompatibleVersion === void 0 ? void 0 : latestCompatibleVersion.grafanaDependency) || ((_c = plugin.details) === null || _c === void 0 ? void 0 : _c.grafanaDependency);
    const hasNoDependencyInfo = !grafanaDependency && (!pluginDependencies || !pluginDependencies.length);
    if (hasNoDependencyInfo) {
        return null;
    }
    return (React.createElement(Stack, { gap: 1 },
        Boolean(grafanaDependency) && (React.createElement("div", { className: styles.depBadge },
            React.createElement(Icon, { name: "grafana", className: styles.icon }),
            "Grafana ",
            grafanaDependency)),
        pluginDependencies && pluginDependencies.length > 0 && (React.createElement("div", null, pluginDependencies.map((p) => {
            return (React.createElement("span", { className: styles.depBadge, key: p.name },
                React.createElement(Icon, { name: PluginIconName[p.type], className: styles.icon }),
                p.name,
                " ",
                p.version));
        })))));
}
export const getStyles = (theme) => {
    return {
        dependencyTitle: css `
      margin-right: ${theme.spacing(0.5)};

      &::after {
        content: '';
        padding: 0;
      }
    `,
        depBadge: css({
            display: 'flex',
            alignItems: 'flex-start',
        }),
        icon: css `
      color: ${theme.colors.text.secondary};
      margin-right: ${theme.spacing(0.5)};
    `,
    };
};
//# sourceMappingURL=PluginDetailsHeaderDependencies.js.map