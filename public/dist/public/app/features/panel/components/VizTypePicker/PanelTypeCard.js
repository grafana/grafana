import { css, cx } from '@emotion/css';
import React from 'react';
import { isUnsignedPluginSignature, PluginState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { IconButton, PluginSignatureBadge, useStyles2 } from '@grafana/ui';
import { PluginStateInfo } from 'app/features/plugins/components/PluginStateInfo';
export const PanelTypeCard = ({ isCurrent, title, plugin, onClick, onDelete, disabled, showBadge, description, children, }) => {
    const styles = useStyles2(getStyles);
    const isDisabled = disabled || plugin.state === PluginState.deprecated;
    const cssClass = cx({
        [styles.item]: true,
        [styles.itemDisabled]: isDisabled,
        [styles.current]: isCurrent,
    });
    return (
    // TODO: fix keyboard a11y
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    React.createElement("div", { className: cssClass, "aria-label": selectors.components.PluginVisualization.item(plugin.name), "data-testid": selectors.components.PluginVisualization.item(plugin.name), onClick: isDisabled ? undefined : onClick, title: isCurrent ? 'Click again to close this section' : plugin.name },
        React.createElement("img", { className: cx(styles.img, { [styles.disabled]: isDisabled }), src: plugin.info.logos.small, alt: "" }),
        React.createElement("div", { className: cx(styles.itemContent, { [styles.disabled]: isDisabled }) },
            React.createElement("div", { className: styles.name }, title),
            description ? React.createElement("span", { className: styles.description }, description) : null,
            children),
        showBadge && (React.createElement("div", { className: cx(styles.badge, { [styles.disabled]: isDisabled }) },
            React.createElement(PanelPluginBadge, { plugin: plugin }))),
        onDelete && (React.createElement(IconButton, { name: "trash-alt", onClick: (e) => {
                e.stopPropagation();
                onDelete();
            }, className: styles.deleteButton, "aria-label": "Delete button on panel type card", tooltip: "Delete" }))));
};
PanelTypeCard.displayName = 'PanelTypeCard';
const getStyles = (theme) => {
    return {
        item: css `
      position: relative;
      display: flex;
      flex-shrink: 0;
      cursor: pointer;
      background: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.radius.default};
      box-shadow: ${theme.shadows.z1};
      border: 1px solid ${theme.colors.background.secondary};
      align-items: center;
      padding: 8px;
      width: 100%;
      position: relative;
      overflow: hidden;
      transition: ${theme.transitions.create(['background'], {
            duration: theme.transitions.duration.short,
        })};

      &:hover {
        background: ${theme.colors.emphasize(theme.colors.background.secondary, 0.03)};
      }
    `,
        itemContent: css `
      overflow: hidden;
      position: relative;
      padding: ${theme.spacing(0, 1)};
    `,
        itemDisabled: css `
      cursor: default;

      &,
      &:hover {
        background: ${theme.colors.action.disabledBackground};
      }
    `,
        current: css `
      label: currentVisualizationItem;
      border: 1px solid ${theme.colors.primary.border};
      background: ${theme.colors.action.selected};
    `,
        disabled: css `
      opacity: 0.6;
      filter: grayscale(1);
      cursor: default;
      pointer-events: none;
    `,
        name: css `
      text-overflow: ellipsis;
      overflow: hidden;
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.fontWeightMedium};
      width: 100%;
    `,
        description: css `
      display: block;
      text-overflow: ellipsis;
      overflow: hidden;
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.fontWeightLight};
      width: 100%;
      max-height: 4.5em;
    `,
        img: css `
      max-height: 38px;
      width: 38px;
      display: flex;
      align-items: center;
    `,
        badge: css `
      background: ${theme.colors.background.primary};
    `,
        deleteButton: css `
      cursor: pointer;
      margin-left: auto;
    `,
    };
};
const PanelPluginBadge = ({ plugin }) => {
    if (isUnsignedPluginSignature(plugin.signature)) {
        return React.createElement(PluginSignatureBadge, { status: plugin.signature });
    }
    return React.createElement(PluginStateInfo, { state: plugin.state });
};
PanelPluginBadge.displayName = 'PanelPluginBadge';
//# sourceMappingURL=PanelTypeCard.js.map