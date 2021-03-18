import React from 'react';
import { GrafanaTheme, isUnsignedPluginSignature, PanelPluginMeta, PluginState } from '@grafana/data';
import { Badge, BadgeProps, PluginSignatureBadge, styleMixins, stylesFactory, useTheme } from '@grafana/ui';
import { css, cx } from 'emotion';
import { selectors } from '@grafana/e2e-selectors';

interface Props {
  isCurrent: boolean;
  plugin: PanelPluginMeta;
  onClick: () => void;
  disabled: boolean;
}

const VizTypePickerPlugin: React.FC<Props> = ({ isCurrent, plugin, onClick, disabled }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const cssClass = cx({
    [styles.item]: true,
    [styles.disabled]: disabled || plugin.state === PluginState.deprecated,
    [styles.current]: isCurrent,
  });

  return (
    <div className={styles.wrapper} aria-label={selectors.components.PluginVisualization.item(plugin.name)}>
      <div
        className={cssClass}
        onClick={disabled ? () => {} : onClick}
        title={isCurrent ? 'Click again to close this section' : plugin.name}
      >
        <div className={styles.itemContent}>
          <div className={styles.name} title={plugin.name}>
            {plugin.name}
          </div>
          <img className={styles.img} src={plugin.info.logos.small} />
        </div>
      </div>
      <div className={cx(styles.badge, disabled && styles.disabled)}>
        <PanelPluginBadge plugin={plugin} />
      </div>
    </div>
  );
};

VizTypePickerPlugin.displayName = 'VizTypePickerPlugin';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      position: relative;
    `,
    item: css`
      display: flex;
      flex-shrink: 0;
      flex-direction: column;
      text-align: center;
      cursor: pointer;
      background: ${theme.colors.bg2};
      border: 1px solid ${theme.colors.border2};
      border-radius: ${theme.border.radius.sm};
      margin-right: 10px;
      align-items: center;
      justify-content: center;
      padding-bottom: 6px;
      height: 100px;
      width: 100%;
      position: relative;

      &:hover {
        background: ${styleMixins.hoverColor(theme.colors.bg1, theme)};
      }
    `,
    itemContent: css`
      position: relative;
      width: 100%;
    `,
    current: css`
      label: currentVisualizationItem;
      border-color: ${theme.colors.bgBlue1};
    `,
    disabled: css`
      opacity: 0.2;
      filter: grayscale(1);
      cursor: default;
      pointer-events: none;

      &:hover {
        border: 1px solid ${theme.colors.border2};
      }
    `,
    name: css`
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
      font-size: ${theme.typography.size.sm};
      text-align: center;
      height: 23px;
      font-weight: ${theme.typography.weight.semibold};
      padding: 0 10px;
      width: 100%;
    `,
    img: css`
      height: 55px;
    `,
    badge: css`
      position: absolute;
      background: ${theme.colors.bg1};
      bottom: ${theme.spacing.xs};
      right: ${theme.spacing.xs};
      z-index: 1;
    `,
  };
});

export default VizTypePickerPlugin;

interface PanelPluginBadgeProps {
  plugin: PanelPluginMeta;
}
const PanelPluginBadge: React.FC<PanelPluginBadgeProps> = ({ plugin }) => {
  const display = getPanelStateBadgeDisplayModel(plugin);

  if (isUnsignedPluginSignature(plugin.signature)) {
    return <PluginSignatureBadge status={plugin.signature} />;
  }

  if (!display) {
    return null;
  }

  return <Badge color={display.color} text={display.text} icon={display.icon} tooltip={display.tooltip} />;
};

function getPanelStateBadgeDisplayModel(panel: PanelPluginMeta): BadgeProps | null {
  switch (panel.state) {
    case PluginState.deprecated:
      return {
        text: 'Deprecated',
        color: 'red',
        tooltip: `${panel.name} panel is deprecated`,
      };
    case PluginState.alpha:
      return {
        text: 'Alpha',
        color: 'blue',
        tooltip: `${panel.name} panel is experimental`,
      };
    case PluginState.beta:
      return {
        text: 'Beta',
        color: 'blue',
        tooltip: `${panel.name} panel is in beta`,
      };
    default:
      return null;
  }
}

PanelPluginBadge.displayName = 'PanelPluginBadge';
