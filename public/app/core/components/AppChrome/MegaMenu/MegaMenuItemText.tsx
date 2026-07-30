import { css, cx } from '@emotion/css';
import * as React from 'react';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
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
  /** Drop empty pin/hide control columns instead of reserving them (so a lone pin sits flush right). */
  collapseEmptyControls?: boolean;
  /** Disable the pin/hide controls (e.g. while a save is in flight) so edits can't be made and lost. */
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
  canCustomise,
  itemName,
  editMode,
  isHideable,
  isHidden,
  onToggleHidden,
  collapseEmptyControls,
  disabled,
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

  // Pinning is a customisation action, so with customisation on the pin control only appears while
  // editing. The legacy (flag-off) bookmark control keeps its always-on-hover behaviour.
  const showPinControl =
    showPin && contextSrv.isSignedIn && Boolean(url) && url !== '/bookmarks' && (!canCustomise || Boolean(editMode));
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

  // When customising, a filled pin marks a pinned item and an outline pin an unpinned one; with
  // customisation off it's the legacy bookmark glyph.
  let pinIcon: IconName = 'bookmark';
  if (canCustomise) {
    pinIcon = isPinned ? 'gf-pin-filled' : 'gf-pin-unfilled';
  }

  const pinButton = (
    <IconButton
      name={pinIcon}
      // Always-visible in edit mode; hover-only (the `pin-icon` treatment) for the legacy control.
      className={canCustomise ? 'customise-icon' : 'pin-icon'}
      iconType={isPinned ? 'solid' : 'default'}
      onClick={() => onPin(url)}
      aria-pressed={isPinned}
      disabled={disabled}
      tooltip={pinTooltip}
    />
  );

  const hideButton = (
    <IconButton
      name={isHidden ? 'eye-slash' : 'eye'}
      className={'visibility-icon'}
      onClick={onToggleHidden}
      aria-pressed={isHidden}
      disabled={disabled}
      tooltip={
        isHidden
          ? t('navigation.item.show.tooltip', 'Show {{itemName}}', { itemName })
          : t('navigation.item.hide.tooltip', 'Hide {{itemName}}', { itemName })
      }
    />
  );

  return (
    <div
      className={cx(
        styles.wrapper,
        // A subtle hover/focus highlight on every row (the active row keeps its selected background).
        !isActive && styles.hoverable,
        isActive && styles.wrapperActive,
        editMode && isHidden && styles.hiddenInEdit
      )}
    >
      <LinkComponent
        data-testid={selectors.components.NavMenu.item}
        className={cx(styles.container, editMode && styles.containerEditMode)}
        href={url}
        target={target}
        // While customising, the row is for pin/hide/reorder only — its link must not navigate.
        onClick={editMode ? (event) => event.preventDefault() : onClick}
        tabIndex={editMode ? -1 : undefined}
        {...(isActive && { 'aria-current': 'page' })}
      >
        {linkContent}
      </LinkComponent>
      {canCustomise
        ? (showPinControl || showHideControl) && (
            // Fixed-width slots so the pin and hide controls line up in columns across every row (a
            // pin-only row keeps the pin in the pin column, leaving the hide column empty). When
            // collapseEmptyControls is set, empty columns are dropped so a lone control sits flush right.
            <div className={styles.controls}>
              {(showPinControl || !collapseEmptyControls) && (
                <span className={styles.controlSlot}>{showPinControl && pinButton}</span>
              )}
              {(showHideControl || !collapseEmptyControls) && (
                <span className={styles.controlSlot}>{showHideControl && hideButton}</span>
              )}
            </div>
          )
        : showPinControl && (
            <Stack alignItems="center" gap={0} shrink={0}>
              {pinButton}
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
    color: isActive ? theme.colors.text.primary : theme.colors.text.secondary,
    width: '100%',
    height: '100%',
    // The pin control shows on hover/focus (both the legacy bookmark and, outside edit mode, the
    // customisation pin); the edit-mode pin and hide controls are always shown.
    '.pin-icon': {
      visibility: 'hidden',
    },
    '.customise-icon, .visibility-icon': {
      visibility: 'visible',
    },
    '&:hover, &:focus-within': {
      '.pin-icon': {
        visibility: 'visible',
      },
    },
  }),
  // Subtle hover/focus highlight for normal browsing (not while customising).
  hoverable: css({
    borderRadius: theme.shape.radius.default,
    '&:hover, &:focus-within': {
      backgroundColor: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
  }),
  // Fixed control columns (pin, hide) so each control type lines up vertically across rows.
  controls: css({
    display: 'flex',
    flexShrink: 0,
  }),
  // One fixed-width, centred column per control (pin, hide) so each control type lines up vertically
  // across rows regardless of which controls a given row shows.
  controlSlot: css({
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    justifyContent: 'center',
    width: theme.spacing(3),
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
    color: 'inherit',
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
  // While customising, the label is not a navigation target — drop the pointer affordances.
  containerEditMode: css({
    cursor: 'default',
    pointerEvents: 'none',
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
