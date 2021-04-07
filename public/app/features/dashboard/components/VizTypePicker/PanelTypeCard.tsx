import React from 'react';
import { GrafanaTheme, isUnsignedPluginSignature, PanelPluginMeta, PluginState } from '@grafana/data';
import { Badge, BadgeProps, IconButton, PluginSignatureBadge, styleMixins, useStyles } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { selectors } from '@grafana/e2e-selectors';

interface Props {
  isCurrent: boolean;
  plugin: PanelPluginMeta;
  title: string;
  onClick: () => void;
  onDelete?: () => void;
  disabled?: boolean;
  showBadge?: boolean;
}

export const PanelTypeCard: React.FC<Props> = ({
  isCurrent,
  title,
  plugin,
  onClick,
  onDelete,
  disabled,
  showBadge,
}) => {
  const styles = useStyles(getStyles);
  const cssClass = cx({
    [styles.item]: true,
    [styles.disabled]: disabled || plugin.state === PluginState.deprecated,
    [styles.current]: isCurrent,
  });

  return (
    <div
      className={cssClass}
      aria-label={selectors.components.PluginVisualization.item(plugin.name)}
      onClick={disabled ? undefined : onClick}
      title={isCurrent ? 'Click again to close this section' : plugin.name}
    >
      <img className={styles.img} src={plugin.info.logos.small} />

      <div className={styles.itemContent}>
        <div className={styles.name}>{title}</div>
      </div>
      {showBadge && (
        <div className={cx(styles.badge, disabled && styles.disabled)}>
          <PanelPluginBadge plugin={plugin} />
        </div>
      )}
      {onDelete && (
        <IconButton
          name="trash-alt"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        />
      )}
    </div>
  );
};

PanelTypeCard.displayName = 'PanelTypeCard';

const getStyles = (theme: GrafanaTheme) => {
  return {
    item: css`
      position: relative;
      display: flex;
      flex-shrink: 0;
      cursor: pointer;
      background: ${theme.colors.bg2};
      border: 1px solid ${theme.colors.border2};
      border-radius: ${theme.border.radius.sm};
      align-items: center;
      padding: 8px;
      width: 100%;
      position: relative;
      overflow: hidden;
      height: 55px;

      &:hover {
        background: ${styleMixins.hoverColor(theme.colors.bg2, theme)};
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
      font-weight: ${theme.typography.weight.semibold};
      padding: 0 10px;
      width: 100%;
    `,
    img: css`
      max-height: 38px;
      width: 38px;
      display: flex;
      align-items: center;
    `,
    badge: css`
      background: ${theme.colors.bg1};
    `,
  };
};

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
        tooltip: `${panel.name} Panel is deprecated`,
      };
    case PluginState.alpha:
      return {
        text: 'Alpha',
        color: 'blue',
        tooltip: `${panel.name} Panel is experimental`,
      };
    case PluginState.beta:
      return {
        text: 'Beta',
        color: 'blue',
        tooltip: `${panel.name} Panel is in beta`,
      };
    default:
      return null;
  }
}

PanelPluginBadge.displayName = 'PanelPluginBadge';
