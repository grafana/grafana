import { css, cx } from '@emotion/css';
import React from 'react';
import { Icon, useStyles2 } from '@grafana/ui';
import { PluginIconName, PluginListDisplayMode } from '../types';
import { PluginListItemBadges } from './PluginListItemBadges';
import { PluginLogo } from './PluginLogo';
export const LOGO_SIZE = '48px';
export function PluginListItem({ plugin, pathName, displayMode = PluginListDisplayMode.Grid }) {
    const styles = useStyles2(getStyles);
    const isList = displayMode === PluginListDisplayMode.List;
    return (React.createElement("a", { href: `${pathName}/${plugin.id}`, className: cx(styles.container, { [styles.list]: isList }) },
        React.createElement(PluginLogo, { src: plugin.info.logos.small, className: styles.pluginLogo, height: LOGO_SIZE, alt: "" }),
        React.createElement("h2", { className: cx(styles.name, 'plugin-name') }, plugin.name),
        React.createElement("div", { className: cx(styles.content, 'plugin-content') },
            React.createElement("p", null,
                "By ",
                plugin.orgName),
            React.createElement(PluginListItemBadges, { plugin: plugin })),
        React.createElement("div", { className: styles.pluginType }, plugin.type && React.createElement(Icon, { name: PluginIconName[plugin.type], title: `${plugin.type} plugin` }))));
}
// Styles shared between the different type of list items
export const getStyles = (theme) => {
    return {
        container: css `
      display: grid;
      grid-template-columns: ${LOGO_SIZE} 1fr ${theme.spacing(3)};
      grid-template-rows: auto;
      gap: ${theme.spacing(2)};
      grid-auto-flow: row;
      background: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.radius.default};
      padding: ${theme.spacing(3)};
      transition: ${theme.transitions.create(['background-color', 'box-shadow', 'border-color', 'color'], {
            duration: theme.transitions.duration.short,
        })};

      &:hover {
        background: ${theme.colors.emphasize(theme.colors.background.secondary, 0.03)};
      }
    `,
        list: css `
      row-gap: 0px;

      > img {
        align-self: start;
      }

      > .plugin-content {
        min-height: 0px;
        grid-area: 2 / 2 / 4 / 3;

        > p {
          margin: ${theme.spacing(0, 0, 0.5, 0)};
        }
      }

      > .plugin-name {
        align-self: center;
        grid-area: 1 / 2 / 2 / 3;
      }
    `,
        pluginType: css `
      grid-area: 1 / 3 / 2 / 4;
      color: ${theme.colors.text.secondary};
    `,
        pluginLogo: css `
      grid-area: 1 / 1 / 3 / 2;
      max-width: 100%;
      align-self: center;
      object-fit: contain;
    `,
        content: css `
      grid-area: 3 / 1 / 4 / 3;
      color: ${theme.colors.text.secondary};
    `,
        name: css `
      grid-area: 1 / 2 / 3 / 3;
      align-self: center;
      font-size: ${theme.typography.h4.fontSize};
      color: ${theme.colors.text.primary};
      margin: 0;
    `,
    };
};
//# sourceMappingURL=PluginListItem.js.map