import { css, cx } from '@emotion/css';
import { useCallback, useState } from 'react';

import { colorManipulator, type GrafanaTheme2 } from '@grafana/data/themes';
import { t } from '@grafana/i18n';
import { Icon } from '@grafana/ui/components/icons';
import { useStyles2, useTheme2 } from '@grafana/ui/themes';

import { type ActionItem, Actions } from '../../../Actions';
import { QueryEditorType, SIDEBAR_CARD_HEIGHT, SIDEBAR_CARD_INDENT, SIDEBAR_CARD_SPACING } from '../../../constants';
import { useQueryEditorTypeConfig } from '../../QueryEditorContext';
import { getEditorBorderColor } from '../../utils';
import { AddCardButton } from '../AddCardButton';
import { getGhostCardVisuals } from '../SidebarCardGhostStyles';

interface SidebarCardProps {
  children: React.ReactNode;
  id: string;
  isSelected: boolean;
  isPartOfSelection?: boolean;
  item: ActionItem;
  onSelect: (modifiers?: { multi?: boolean; range?: boolean }) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onToggleHide?: () => void;
  variant?: 'default' | 'ghost';
}

const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
  if (e.shiftKey) {
    // Shift+Click is used for range-selection of cards, not text.
    e.preventDefault();
  }
  // @hello-pangea/dnd's capture-phase mousedown listener calls preventDefault, so browser focus
  // transfer never fires and Monaco never sees a natural blur. Force it imperatively.
  if (document.activeElement instanceof HTMLElement && document.activeElement !== e.currentTarget) {
    document.activeElement.blur();
  }
};

export const SidebarCard = ({
  children,
  id,
  isSelected,
  isPartOfSelection,
  item,
  onSelect,
  onDelete,
  onDuplicate,
  onToggleHide,
  variant = 'default',
}: SidebarCardProps) => {
  const theme = useTheme2();
  const typeConfig = useQueryEditorTypeConfig();
  const addVariant = item.type === QueryEditorType.Transformation ? 'transformation' : 'query';
  const hasActions = onDelete || onDuplicate || onToggleHide;
  const [hasFocusWithin, setHasFocusWithin] = useState(false);

  const styles = useStyles2(getStyles, { isSelected, isPartOfSelection, item });

  const handleFocus = useCallback(() => {
    setHasFocusWithin(true);
  }, []);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) {
      setHasFocusWithin(false);
    }
  }, []);

  // Setter function to reset the focus state of the card when the modal is closed.
  const handleResetFocus = useCallback(() => {
    setHasFocusWithin(false);
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onSelect({ multi: e.metaKey || e.ctrlKey, range: e.shiftKey });
  };

  // Using a div with role="button" instead of a native button for @hello-pangea/dnd compatibility,
  // so we manually handle Enter and Space key activation.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) {
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect({});
    }
  };

  if (variant === 'ghost') {
    const config = typeConfig[item.type];
    return (
      <div className={cx(styles.wrapper, styles.ghostWrapper)} aria-hidden>
        <div className={cx(styles.card, styles.ghostCard)}>
          <div className={styles.cardContent}>
            <Icon name={config.icon} size="sm" className={styles.ghostCardIcon} />
            <span className={styles.ghostCardLabel}>
              {t('query-editor-next.sidebar.new-type', 'New {{type}}', { type: config.getLabel() })}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.card}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        role="button"
        tabIndex={0}
        data-query-sidebar-card={id}
        aria-label={t('query-editor-next.sidebar.card-click', 'Select card {{id}}', { id })}
        aria-pressed={isSelected || isPartOfSelection}
      >
        <div className={styles.cardContent}>{children}</div>
        {/** Alerts don't have actions and cannot be hidden so we don't need to show the hidden icon or hover actions. */}
        {/** hasActions is indicating if this is an alert card or a query/transformation card. */}
        {hasActions && (
          <div>
            <div className={styles.cardContentIcons}>
              {item.isHidden && <Icon name="eye-slash" size="sm" />}
              {!!item.error && <Icon name="exclamation-triangle" size="sm" color={theme.colors.error.text} />}
            </div>
            <div className={cx(styles.hoverActions, { [styles.hoverActionsVisible]: hasFocusWithin })}>
              <Actions
                handleResetFocus={handleResetFocus}
                item={item}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onToggleHide={onToggleHide}
                order={{
                  delete: 1,
                  duplicate: 0,
                  hide: 2,
                }}
              />
            </div>
          </div>
        )}
      </div>
      <AddCardButton variant={addVariant} afterId={id} />
    </div>
  );
};

function getStyles(
  theme: GrafanaTheme2,
  {
    isSelected,
    isPartOfSelection,
    item,
  }: {
    isSelected?: boolean;
    isPartOfSelection?: boolean;
    item: ActionItem;
  }
) {
  // TODO: I think we should refactor this so we aren't relying on this border color for the selected card.
  const borderColor = getEditorBorderColor({
    theme,
    editorType: item.type,
    alertState: item.alertState,
    isError: !!item.error,
  });

  const selectedBg = `color-mix(in srgb, ${borderColor} 10%, ${theme.colors.background.primary})`;
  const hoverBackgroundColor = isSelected ? selectedBg : colorManipulator.alpha(theme.colors.text.primary, 0.08);
  const hoverSolidBg = isSelected ? selectedBg : theme.colors.background.secondary;

  const {
    ghostBackgroundColor,
    ghostBorderColor,
    ghostAnimations,
    ghostAnimationDelays,
    ghostBlobStrong,
    ghostBlobMedium,
    ghostBlobSoft,
    ghostBlobOpacity,
    ghostIconColor,
  } = getGhostCardVisuals(theme);

  const hoverActions = css({
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    paddingRight: theme.spacing(1),
    // increasing the left padding lets the gradient become transparent before the first button rather than behind the first button
    paddingLeft: theme.spacing(3),
    borderRadius: `0 ${theme.shape.radius.default} ${theme.shape.radius.default} 0`,
    background: `linear-gradient(270deg, ${hoverSolidBg} 80%, transparent 100%)`,
    opacity: 0,
    transform: 'translateX(8px)',
    pointerEvents: 'none',
    // This transition handles the opacity and transform of the hover actions when the card is hovered.
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['opacity', 'transform'], {
        duration: theme.transitions.duration.standard,
      }),
    },
  });

  const inSelection = isSelected || isPartOfSelection;
  const cardBorder = !!item.error
    ? `1px solid ${theme.colors.error.border}`
    : `1px solid ${inSelection ? borderColor : theme.colors.border.medium}`;

  const selectionTintBg = `color-mix(in srgb, ${borderColor} 5%, ${theme.colors.background.primary})`;

  // Selection-based styling
  const cardBackground = isSelected
    ? selectedBg
    : isPartOfSelection
      ? selectionTintBg
      : theme.colors.background.primary;
  const cardBoxShadow = isSelected ? `0 0 4px 0 color-mix(in srgb, ${borderColor} 40%, transparent)` : 'none';
  const indicatorWidth = isSelected ? 3 : 2;

  return {
    cardContentIcons: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginRight: theme.spacing(1.5),
    }),
    wrapper: css({
      position: 'relative',
      marginLeft: theme.spacing(SIDEBAR_CARD_INDENT),
      marginRight: theme.spacing(SIDEBAR_CARD_INDENT),

      // Two slim pseudo-element strips extend the hover zone to the left and
      // below the card, covering the path to the "+" button without overlapping
      // the card's clickable area.

      // Left strip: narrow gutter running along the card's left edge and below.
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: `calc(-1 * ${theme.spacing(3.5)})`,
        width: theme.spacing(3.5),
        height: `calc(100% + ${theme.spacing(1.5)})`,
      },

      // Bottom strip: runs along the card's bottom edge extending to the left.
      '&::after': {
        content: '""',
        position: 'absolute',
        top: '100%',
        left: `calc(-1 * ${theme.spacing(3.5)})`,
        width: `calc(100% + ${theme.spacing(3.5)})`,
        height: theme.spacing(1.5),
      },

      '&:hover': {
        zIndex: 1,
      },

      '&:hover [data-add-button], & [data-menu-open]': {
        opacity: 1,
        pointerEvents: 'auto',
      },
    }),
    ghostWrapper: css({
      marginTop: theme.spacing(SIDEBAR_CARD_SPACING),
    }),

    card: css({
      position: 'relative',
      minHeight: SIDEBAR_CARD_HEIGHT,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',

      width: '100%',
      background: cardBackground,
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',

      overflow: 'hidden',
      border: cardBorder,
      boxShadow: cardBoxShadow,
      '&::before': {
        content: '""',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: indicatorWidth,
        background: borderColor,
        [theme.transitions.handleMotion('no-preference', 'reduce')]: {
          transition: theme.transitions.create(['width'], {
            duration: theme.transitions.duration.standard,
          }),
        },
      },

      ...(item.isHidden && {
        opacity: theme.isDark ? 0.6 : 0.7,
        filter: 'grayscale(0.8)',
        boxShadow: 'none',
      }),

      // This transitions the background color of the card when it is hovered or selected.
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background-color', 'box-shadow', 'opacity', 'filter'], {
          duration: theme.transitions.duration.standard,
        }),
      },
      '&:hover': {
        background: hoverBackgroundColor,
      },
      [`&:hover .${hoverActions}`]: {
        opacity: 1,
        transform: 'translateX(0)',
        pointerEvents: 'auto',
      },
      '[data-is-dragging] &': {
        background: hoverBackgroundColor,
      },
    }),
    hoverActions,
    hoverActionsVisible: css({
      opacity: 1,
      transform: 'translateX(0)',
      pointerEvents: 'auto',
    }),

    cardContent: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5, 1, 0.5, 1.25),
      overflow: 'hidden',
      minWidth: 0,
      flex: 1,
      // This transitions the opacity of the card text when the card is hidden.
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['opacity'], {
          duration: theme.transitions.duration.standard,
        }),
      },
    }),

    ghostCard: css({
      border: `1px solid ${ghostBorderColor}`,
      background: ghostBackgroundColor,
      cursor: 'default',
      opacity: 1,
      '&::before': {
        display: 'block',
        width: 2,
        background: borderColor,
      },
      '&::after': {
        content: '""',
        position: 'absolute',
        inset: '-15%',
        pointerEvents: 'none',
        backgroundImage: [
          `radial-gradient(ellipse 42% 32% at 12% 28%, ${ghostBlobStrong}, transparent)`,
          `radial-gradient(ellipse 34% 26% at 84% 18%, ${ghostBlobMedium}, transparent)`,
          `radial-gradient(ellipse 30% 38% at 44% 82%, ${ghostBlobSoft}, transparent)`,
        ].join(', '),
        backgroundRepeat: 'no-repeat',
        filter: 'blur(7px)',
        opacity: ghostBlobOpacity,
        [theme.transitions.handleMotion('no-preference')]: {
          animation: ghostAnimations,
          animationDelay: ghostAnimationDelays,
        },
      },
      '& > div': {
        position: 'relative',
        zIndex: 1,
      },
    }),
    ghostCardIcon: css({
      color: ghostIconColor,
    }),

    ghostCardLabel: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontStyle: 'italic',
      color: theme.colors.text.secondary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
  };
}
