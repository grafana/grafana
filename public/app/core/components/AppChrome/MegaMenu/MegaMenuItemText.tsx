import { css, cx } from '@emotion/css';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { Icon, IconButton, Link, useTheme2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';
import { contextSrv } from 'app/core/services/context_srv';

export interface Props {
  children: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  target?: HTMLAnchorElement['target'];
  url: string;
  onPin: (id?: string) => void;
  isPinned?: boolean;
  showPin?: boolean;
  navigationInfoArchRefresh?: boolean;
  itemName: string;
  disabled?: boolean;
}

export function MegaMenuItemText({
  children,
  isActive,
  onClick,
  target,
  url,
  onPin,
  isPinned,
  showPin = true,
  navigationInfoArchRefresh,
  itemName,
  disabled,
}: Props) {
  const theme = useTheme2();
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const styles = getStyles(theme, isActive, visualRefreshEnabled);
  const LinkComponent = !target && url.startsWith('/') ? Link : 'a';
  const interpolation = { itemName, interpolation: { escapeValue: false } };
  const pinTooltip = navigationInfoArchRefresh
    ? isPinned
      ? t('navigation.item.unpin.tooltip', 'Unpin {{itemName}}', interpolation)
      : t('navigation.item.pin.tooltip', 'Pin {{itemName}}', interpolation)
    : t('navigation.item.bookmark.tooltip', 'Bookmark {{itemName}}', interpolation);
  const showPinControl = showPin && contextSrv.isSignedIn && Boolean(url) && url !== '/bookmarks';

  return (
    <div className={cx(styles.wrapper, !isActive && styles.hoverable, isActive && styles.wrapperActive)}>
      <LinkComponent
        data-testid={selectors.components.NavMenu.item}
        className={styles.container}
        href={url}
        target={target}
        onClick={onClick}
        {...(isActive && { 'aria-current': 'page' })}
      >
        <div className={styles.linkContent}>
          {children}
          {target === '_blank' && <Icon data-testid="external-link-icon" name="external-link-alt" />}
        </div>
      </LinkComponent>
      {showPinControl && (
        <span className={styles.controlSlot}>
          <IconButton
            name={navigationInfoArchRefresh ? (isPinned ? 'gf-pin-filled' : 'gf-pin-unfilled') : 'bookmark'}
            className="pin-icon"
            iconType={isPinned ? 'solid' : 'default'}
            onClick={() => onPin(url)}
            aria-pressed={isPinned}
            disabled={disabled}
            tooltip={pinTooltip}
          />
        </span>
      )}
    </div>
  );
}

MegaMenuItemText.displayName = 'MegaMenuItemText';

const getStyles = (theme: GrafanaTheme2, isActive: Props['isActive'], visualRefreshEnabled: boolean) => ({
  wrapper: css({
    display: 'flex',
    alignItems: 'center',
    color: isActive ? theme.colors.text.primary : theme.colors.text.secondary,
    width: '100%',
    height: '100%',
    // Keep the control in the tab order even before the row receives keyboard focus.
    '.pin-icon': { opacity: 0 },
    '&:hover, &:focus-within': { '.pin-icon': { opacity: 1 } },
  }),
  hoverable: css({
    borderRadius: theme.shape.radius.default,
    '&:hover, &:focus-within': {
      backgroundColor: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
  }),
  controlSlot: css({
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    justifyContent: 'center',
    width: theme.spacing(3),
  }),
  wrapperActive: visualRefreshEnabled
    ? css({
        backgroundColor: theme.colors.accent.subtleBackground,
        position: 'relative',
        borderRadius: theme.shape.radius.default,
      })
    : css({
        backgroundColor: theme.colors.action.selected,
        borderTopRightRadius: theme.shape.radius.default,
        borderBottomRightRadius: theme.shape.radius.default,
        position: 'relative',
        color: theme.colors.text.primary,
        '&::before': {
          backgroundImage: theme.colors.gradients.brandVertical,
          borderRadius: theme.shape.radius.default,
          content: '" "',
          display: 'block',
          height: '100%',
          position: 'absolute',
          transform: 'translateX(-50%)',
          left: 0,
          width: theme.spacing(0.25),
        },
      }),
  container: css({
    alignItems: 'center',
    color: 'inherit',
    height: '100%',
    position: 'relative',
    flex: 1,
    minWidth: 0,
    borderRadius: theme.shape.radius.default,
    '&:hover span, &:focus-visible span': { color: theme.colors.text.primary, textDecoration: 'underline' },
    '&:focus-visible': getFocusStyles(theme),
  }),
  linkContent: css({
    alignItems: 'center',
    display: 'flex',
    gap: '0.5rem',
    height: '100%',
    width: '100%',
    justifyContent: 'space-between',
  }),
});
