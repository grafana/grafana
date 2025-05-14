import { css, cx } from '@emotion/css';
import { MouseEventHandler } from 'react';
import * as React from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2, isUnsignedPluginSignature, PanelPluginMeta, PluginState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { IconButton, PluginSignatureBadge, useStyles2 } from '@grafana/ui';
import { SkeletonComponent, attachSkeleton } from '@grafana/ui/unstable';
import { t } from 'app/core/internationalization';
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

const IMAGE_SIZE = 38;

const PanelTypeCardComponent = ({
  isCurrent,
  title,
  plugin,
  onClick,
  onDelete,
  disabled,
  showBadge,
  description,
  children,
}: React.PropsWithChildren<Props>) => {
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
    <div
      className={cssClass}
      aria-label={selectors.components.PluginVisualization.item(plugin.name)}
      data-testid={selectors.components.PluginVisualization.item(plugin.name)}
      onClick={isDisabled ? undefined : onClick}
      title={
        isCurrent ? t('panel.panel-type-card.title-click-to-close', 'Click again to close this section') : plugin.name
      }
    >
      <img className={cx(styles.img, { [styles.disabled]: isDisabled })} src={plugin.info.logos.small} alt="" />

      <div className={cx(styles.itemContent, { [styles.disabled]: isDisabled })}>
        <div className={styles.name}>{title}</div>
        {description ? <span className={styles.description}>{description}</span> : null}
        {children}
      </div>
      {showBadge && (
        <div className={cx(styles.badge, { [styles.disabled]: isDisabled })}>
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
          className={styles.deleteButton}
          aria-label={t(
            'panel.panel-type-card.aria-label-delete-button-on-panel-type-card',
            'Delete button on panel type card'
          )}
          tooltip={t('panel.panel-type-card.tooltip-delete', 'Delete')}
        />
      )}
    </div>
  );
};
PanelTypeCardComponent.displayName = 'PanelTypeCard';

interface SkeletonProps {
  hasDescription?: boolean;
  hasDelete?: boolean;
}

const PanelTypeCardSkeleton: SkeletonComponent<React.PropsWithChildren<SkeletonProps>> = ({
  children,
  hasDescription,
  hasDelete,
  rootProps,
}) => {
  const styles = useStyles2(getStyles);
  const skeletonStyles = useStyles2(getSkeletonStyles);
  return (
    <div className={styles.item} {...rootProps}>
      <Skeleton className={cx(styles.img, skeletonStyles.image)} width={IMAGE_SIZE} height={IMAGE_SIZE} />

      <div className={styles.itemContent}>
        <div className={styles.name}>
          <Skeleton width={160} />
        </div>
        {hasDescription ? <Skeleton containerClassName={styles.description} width={80} /> : null}
        {children}
      </div>
      {hasDelete && (
        <Skeleton containerClassName={cx(styles.deleteButton, skeletonStyles.deleteButton)} width={16} height={16} />
      )}
    </div>
  );
};

export const PanelTypeCard = attachSkeleton(PanelTypeCardComponent, PanelTypeCardSkeleton);

const getSkeletonStyles = () => {
  return {
    deleteButton: css({
      lineHeight: 1,
    }),
    image: css({
      lineHeight: 1,
    }),
  };
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    item: css({
      position: 'relative',
      display: 'flex',
      flexShrink: 0,
      cursor: 'pointer',
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z1,
      border: `1px solid ${theme.colors.background.secondary}`,
      alignItems: 'center',
      padding: theme.spacing(1),
      width: '100%',
      overflow: 'hidden',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background'], {
          duration: theme.transitions.duration.short,
        }),
      },

      '&:hover': {
        background: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
      },
    }),
    itemContent: css({
      overflow: 'hidden',
      position: 'relative',
      padding: theme.spacing(0, 1),
    }),
    itemDisabled: css({
      cursor: 'default',

      '&, &:hover': {
        background: theme.colors.action.disabledBackground,
      },
    }),
    current: css({
      label: 'currentVisualizationItem',
      border: `1px solid ${theme.colors.primary.border}`,
      background: theme.colors.action.selected,
    }),
    disabled: css({
      opacity: 0.6,
      filter: 'grayscale(1)',
      cursor: 'default',
      pointerEvents: 'none',
    }),
    name: css({
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.fontWeightMedium,
      width: '100%',
    }),
    description: css({
      display: 'block',
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightLight,
      width: '100%',
      maxHeight: '4.5em',
    }),
    img: css({
      maxHeight: IMAGE_SIZE,
      width: IMAGE_SIZE,
      display: 'flex',
      alignItems: 'center',
    }),
    badge: css({
      background: theme.colors.background.primary,
    }),
    deleteButton: css({
      cursor: 'pointer',
      marginLeft: 'auto',
    }),
  };
};

interface PanelPluginBadgeProps {
  plugin: PanelPluginMeta;
}

const PanelPluginBadge = ({ plugin }: PanelPluginBadgeProps) => {
  if (isUnsignedPluginSignature(plugin.signature)) {
    return <PluginSignatureBadge status={plugin.signature} />;
  }

  return <PluginStateInfo state={plugin.state} />;
};

PanelPluginBadge.displayName = 'PanelPluginBadge';
