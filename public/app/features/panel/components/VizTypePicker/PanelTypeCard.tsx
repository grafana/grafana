import React, { MouseEventHandler } from 'react';
import { GrafanaTheme2, isUnsignedPluginSignature, PanelPluginMeta, PluginState } from '@grafana/data';
import { IconButton, PluginSignatureBadge, useStyles2 } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { selectors } from '@grafana/e2e-selectors';
import { PluginStateInfo } from 'app/features/plugins/components/PluginStateInfo';

interface Props {
  isCurrent: boolean;
  plugin: PanelPluginMeta;
  title: string;
  onClick: MouseEventHandler<HTMLDivElement>;
  onDelete?: () => void;
  disabled?: boolean;
  showBadge?: boolean;
  description?: string;
}

export const PanelTypeCard: React.FC<Props> = ({
  isCurrent,
  title,
  plugin,
  onClick,
  onDelete,
  disabled,
  showBadge,
  description,
  children,
}) => {
  const styles = useStyles2(getStyles);
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
      <img className={styles.img} src={plugin.info.logos.small} alt="" />

      <div className={styles.itemContent}>
        <div className={styles.name}>{title}</div>
        {description ? <span className={styles.description}>{description}</span> : null}
        {children}
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
          aria-label="Delete button on panel type card"
        />
      )}
    </div>
  );
};

PanelTypeCard.displayName = 'PanelTypeCard';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    item: css`
      position: relative;
      display: flex;
      flex-shrink: 0;
      cursor: pointer;
      background: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.borderRadius()};
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
    itemContent: css`
      position: relative;
      width: 100%;
      padding: ${theme.spacing(0, 1)};
    `,
    current: css`
      label: currentVisualizationItem;
      border: 1px solid ${theme.colors.primary.border};
      background: ${theme.colors.action.selected};
    `,
    disabled: css`
      opacity: 0.2;
      filter: grayscale(1);
      cursor: default;
      pointer-events: none;
    `,
    name: css`
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.fontWeightMedium};
      width: 100%;
    `,
    description: css`
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.fontWeightLight};
      width: 100%;
    `,
    img: css`
      max-height: 38px;
      width: 38px;
      display: flex;
      align-items: center;
    `,
    badge: css`
      background: ${theme.colors.background.primary};
    `,
  };
};

interface PanelPluginBadgeProps {
  plugin: PanelPluginMeta;
}

const PanelPluginBadge: React.FC<PanelPluginBadgeProps> = ({ plugin }) => {
  if (isUnsignedPluginSignature(plugin.signature)) {
    return <PluginSignatureBadge status={plugin.signature} />;
  }

  return <PluginStateInfo state={plugin.state} />;
};

PanelPluginBadge.displayName = 'PanelPluginBadge';
