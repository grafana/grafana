import { css, cx } from '@emotion/css';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Icon, IconButton, Link, Stack, useTheme2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

export interface Props {
  children: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  target?: HTMLAnchorElement['target'];
  url: string;
  onPin: (id?: string) => void;
  isPinned?: boolean;
  /** Whether to render the bookmark/pin control at all (default true) */
  showPin?: boolean;
  /** Customisation is enabled — switches the control to the pin icon and "Pin"/"Unpin" wording; off keeps the legacy bookmark icon and wording */
  canCustomise?: boolean;
  itemName: string;
  editMode?: boolean;
  isHideable?: boolean;
  isHidden?: boolean;
  onToggleHidden?: () => void;
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
  canCustomise,
  itemName,
  editMode,
  isHideable,
  isHidden,
  onToggleHidden,
}: Props) {
  const theme = useTheme2();

  const styles = getStyles(theme, isActive);
  const LinkComponent = !target && url.startsWith('/') ? Link : 'a';

  // Flag on: pin/unpin wording. Flag off: the legacy "Bookmark" wording.
  let pinTooltip = t('navigation.item.bookmark.tooltip', 'Bookmark {{itemName}}', { itemName });
  if (canCustomise) {
    pinTooltip = isPinned
      ? t('navigation.item.unpin.tooltip', 'Unpin {{itemName}}', { itemName })
      : t('navigation.item.pin.tooltip', 'Pin {{itemName}}', { itemName });
  }

  const showPinControl = showPin && contextSrv.isSignedIn && Boolean(url) && url !== '/bookmarks';
  const showHideControl = Boolean(editMode && isHideable);

  const linkContent = (
    <div className={styles.linkContent}>
      {children}

      {
        // As nav links are supposed to link to internal urls this option should be used with caution
        target === '_blank' && <Icon data-testid="external-link-icon" name="external-link-alt" />
      }
    </div>
  );

  return (
    <div className={cx(styles.wrapper, isActive && styles.wrapperActive, editMode && isHidden && styles.hiddenInEdit)}>
      <LinkComponent
        data-testid={selectors.components.NavMenu.item}
        className={styles.container}
        href={url}
        target={target}
        onClick={onClick}
        {...(isActive && { 'aria-current': 'page' })}
      >
        {linkContent}
      </LinkComponent>
      {(showPinControl || showHideControl) && (
        <Stack alignItems="center" gap={0} shrink={0}>
          {showPinControl && (
            <IconButton
              // No "unpin" icon exists, so the pinned/unpinned distinction is carried by the
              // tooltip and aria-pressed. iconType is a no-op for the custom gf- icon.
              name={canCustomise ? 'gf-pin' : 'bookmark'}
              className={'pin-icon'}
              iconType={isPinned ? 'solid' : 'default'}
              onClick={() => onPin(url)}
              aria-pressed={isPinned}
              tooltip={pinTooltip}
            />
          )}
          {showHideControl && (
            <IconButton
              name={isHidden ? 'eye-slash' : 'eye'}
              className={'visibility-icon'}
              onClick={onToggleHidden}
              aria-pressed={isHidden}
              tooltip={
                isHidden
                  ? t('navigation.item.show.tooltip', 'Show {{itemName}}', { itemName })
                  : t('navigation.item.hide.tooltip', 'Hide {{itemName}}', { itemName })
              }
            />
          )}
        </Stack>
      )}
    </div>
  );
}

MegaMenuItemText.displayName = 'MegaMenuItemText';

const getStyles = (theme: GrafanaTheme2, isActive: Props['isActive']) => ({
  wrapper: css({
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    // The pin shows on hover/focus; the eye toggle (edit mode) is always shown.
    '.pin-icon': {
      visibility: 'hidden',
    },
    '.visibility-icon': {
      visibility: 'visible',
    },
    '&:hover, &:focus-within': {
      '.pin-icon': {
        visibility: 'visible',
      },
    },
  }),
  hiddenInEdit: css({
    opacity: 0.5,
  }),
  wrapperActive: css({
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
    color: isActive ? theme.colors.text.primary : theme.colors.text.secondary,
    height: '100%',
    position: 'relative',
    flex: 1,
    minWidth: 0,

    '&:hover span, &:focus-visible span': {
      color: theme.colors.text.primary,
      textDecoration: 'underline',
    },

    '&:focus-visible': {
      boxShadow: 'none',
      outline: `2px solid ${theme.colors.accent.main}`,
      outlineOffset: '-2px',
    },
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
