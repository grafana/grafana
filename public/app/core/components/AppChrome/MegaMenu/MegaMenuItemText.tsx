import { css, cx } from '@emotion/css';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { Icon, IconButton, Link, useTheme2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

export interface Props {
  children: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  target?: HTMLAnchorElement['target'];
  url: string;
  itemName: string;
  editMode?: boolean;
  /** Whether this item can be renamed, hidden or reordered (excludes Home, create actions, etc). */
  isCustomizable?: boolean;
  isHidden?: boolean;
  onToggleHidden?: () => void;
  onRename?: (text: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  /** Disable the customisation controls (e.g. while a save is in flight) so edits can't be lost. */
  disabled?: boolean;
}

export function MegaMenuItemText({
  children,
  isActive,
  onClick,
  target,
  url,
  itemName,
  editMode,
  isCustomizable,
  isHidden,
  onToggleHidden,
  onRename,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  disabled,
}: Props) {
  const theme = useTheme2();
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const styles = getStyles(theme, isActive, visualRefreshEnabled);
  const LinkComponent = !target && url.startsWith('/') ? Link : 'a';

  const showControls = Boolean(editMode && isCustomizable);

  const linkContent = (
    <div className={styles.linkContent}>
      {children}

      {
        // As nav links are supposed to link to internal urls this option should be used with caution
        target === '_blank' && <Icon data-testid="external-link-icon" name="external-link-alt" />
      }
    </div>
  );

  const handleRename = () => {
    // window.prompt is a deliberately hacky way to collect the new label — this whole feature is a
    // testing surface for trying out nav names/ordering, not a production rename UI.
    const next = window.prompt(
      t('navigation.item.rename.prompt', 'Rename "{{itemName}}" to:', {
        itemName,
        interpolation: { escapeValue: false },
      }),
      itemName
    );
    if (next !== null) {
      onRename?.(next);
    }
  };

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
        className={styles.container}
        href={url}
        target={target}
        onClick={onClick}
        {...(isActive && { 'aria-current': 'page' })}
      >
        {linkContent}
      </LinkComponent>
      {showControls && (
        <div className={styles.controls}>
          <IconButton
            name="arrow-up"
            onClick={onMoveUp}
            disabled={disabled || !canMoveUp}
            tooltip={t('navigation.item.move-up.tooltip', 'Move {{itemName}} up', {
              itemName,
              interpolation: { escapeValue: false },
            })}
          />
          <IconButton
            name="arrow-down"
            onClick={onMoveDown}
            disabled={disabled || !canMoveDown}
            tooltip={t('navigation.item.move-down.tooltip', 'Move {{itemName}} down', {
              itemName,
              interpolation: { escapeValue: false },
            })}
          />
          <IconButton
            name="edit"
            onClick={handleRename}
            disabled={disabled}
            tooltip={t('navigation.item.rename.tooltip', 'Rename {{itemName}}', {
              itemName,
              interpolation: { escapeValue: false },
            })}
          />
          <IconButton
            name={isHidden ? 'eye-slash' : 'eye'}
            onClick={onToggleHidden}
            aria-pressed={isHidden}
            disabled={disabled}
            tooltip={
              isHidden
                ? t('navigation.item.show.tooltip', 'Show {{itemName}}', {
                    itemName,
                    interpolation: { escapeValue: false },
                  })
                : t('navigation.item.hide.tooltip', 'Hide {{itemName}}', {
                    itemName,
                    interpolation: { escapeValue: false },
                  })
            }
          />
        </div>
      )}
    </div>
  );
}

MegaMenuItemText.displayName = 'MegaMenuItemText';

const getStyles = (theme: GrafanaTheme2, isActive: Props['isActive'], visualRefreshEnabled: boolean) => {
  const wrapperActiveOld = css({
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
  });

  const wrapperActiveVisualRefresh = css({
    color: theme.colors.accent.text,
    backgroundColor: theme.colors.accent.subtleBackground,
    position: 'relative',
    borderRadius: theme.shape.radius.default,
    '&:hover': {
      color: theme.colors.accent.textEmphasis,
    },
  });

  return {
    wrapper: css({
      display: 'flex',
      alignItems: 'center',
      color: isActive ? theme.colors.text.primary : theme.colors.text.secondary,
      width: '100%',
      height: '100%',
    }),
    // Subtle hover/focus highlight for normal browsing (not while customising).
    hoverable: css({
      borderRadius: theme.shape.radius.default,
      '&:hover, &:focus-within': {
        backgroundColor: theme.colors.action.hover,
        color: theme.colors.text.primary,
      },
    }),
    // The rename/move/hide controls, always visible while editing.
    controls: css({
      display: 'flex',
      flexShrink: 0,
      gap: theme.spacing(0.25),
    }),
    hiddenInEdit: css({
      opacity: 0.5,
    }),
    wrapperActive: visualRefreshEnabled ? wrapperActiveVisualRefresh : wrapperActiveOld,
    container: css({
      alignItems: 'center',
      color: 'inherit',
      height: '100%',
      position: 'relative',
      flex: 1,
      minWidth: 0,
      borderRadius: theme.shape.radius.default,

      '&:hover span, &:focus-visible span': {
        color: theme.colors.text.primary,
        textDecoration: 'underline',
      },

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
  };
};
