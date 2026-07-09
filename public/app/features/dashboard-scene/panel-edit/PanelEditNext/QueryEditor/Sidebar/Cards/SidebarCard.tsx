import { css, cx, keyframes } from '@emotion/css';
import { useCallback, useRef, useState } from 'react';

import { colorManipulator, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, Icon, useStyles2, useTheme2 } from '@grafana/ui';

import { Actions } from '../../../Actions';
import { type ActionItem } from '../../../actionItem';
import {
  QueryEditorType,
  SIDEBAR_CARD_DATA_ATTR,
  SIDEBAR_CARD_HEIGHT,
  SIDEBAR_CARD_INDENT,
  SIDEBAR_CARD_SPACING,
} from '../../../constants';
import { type SelectionModifiers, useQueryEditorTypeConfig, useQueryEditorUIContext } from '../../QueryEditorContext';
import { getEditorBorderColor, getHiddenMaskStyles } from '../../utils';
import { AddCardButton } from '../AddCardButton';
import { getGhostCardVisuals } from '../SidebarCardGhostStyles';

const checkboxPop = keyframes({
  '0%': { transform: 'scale(1)' },
  '45%': { transform: 'scale(0.9)' },
  '100%': { transform: 'scale(1)' },
});

const checkboxTickIn = keyframes({
  '0%': { transform: 'rotate(45deg) scale(0.6)', opacity: 0 },
  '100%': { transform: 'rotate(45deg) scale(1)', opacity: 1 },
});

// The visible checkbox box is 16px (theme.spacing(2)), matching the @grafana/ui
// Checkbox. We extend the click target by CHECKBOX_HIT_PADDING on every side; the
// open slot must therefore be the box plus that padding on both horizontal sides,
// and the slot's negative margins absorb the same padding so nothing visually moves.
const CHECKBOX_BOX_SIZE = 2;
const CHECKBOX_HIT_PADDING = 0.75;
const CHECKBOX_SLOT_OPEN_WIDTH = CHECKBOX_BOX_SIZE + CHECKBOX_HIT_PADDING * 2;

interface SidebarCardProps {
  children: React.ReactNode;
  id: string;
  isSelected: boolean;
  isMultiSelected?: boolean;
  item: ActionItem;
  onSelect: () => void;
  onToggleMultiSelect?: (modifiers?: SelectionModifiers) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onToggleHide?: () => void;
  variant?: 'default' | 'ghost';
}

export const SidebarCard = ({
  children,
  id,
  isSelected,
  isMultiSelected = false,
  item,
  onSelect,
  onToggleMultiSelect,
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
  const shiftRangeSelectRef = useRef(false);
  const { multiSelectMode } = useQueryEditorUIContext();

  const styles = useStyles2(getStyles, { isSelected, item });

  const handleFocus = useCallback(() => {
    setHasFocusWithin(true);
  }, []);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) {
      setHasFocusWithin(false);
    }
  }, []);

  const handleResetFocus = useCallback(() => {
    setHasFocusWithin(false);
  }, []);

  const handleCardMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.shiftKey) {
      e.preventDefault();
    }
    // @hello-pangea/dnd's capture-phase mousedown listener calls preventDefault, so browser focus
    // transfer never fires and Monaco never sees a natural blur. Force it imperatively.
    if (document.activeElement instanceof HTMLElement && document.activeElement !== e.currentTarget) {
      document.activeElement.blur();
    }
  };

  const handleCardClick = () => {
    onSelect();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) {
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  const handleBulkCheckboxMouseDownCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.shiftKey) {
      e.preventDefault();
      shiftRangeSelectRef.current = true;
      onToggleMultiSelect?.({ range: true });
    }
  };

  const handleCheckboxChange = () => {
    if (shiftRangeSelectRef.current) {
      shiftRangeSelectRef.current = false;
      return;
    }
    onToggleMultiSelect?.({ multi: true });
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
      <div className={styles.cardRow}>
        <div
          aria-hidden={!multiSelectMode}
          className={cx(styles.checkboxWrapper, multiSelectMode && styles.checkboxWrapperOpen)}
          {...(!multiSelectMode && { inert: '' })}
        >
          {onToggleMultiSelect && (
            <div className={styles.checkboxClickArea} onMouseDownCapture={handleBulkCheckboxMouseDownCapture}>
              <Checkbox
                className={styles.checkboxHitArea}
                value={isMultiSelected}
                onChange={handleCheckboxChange}
                aria-label={t('query-editor-next.sidebar.card-multi-select', 'Include card {{id}} in bulk selection', {
                  id,
                })}
              />
            </div>
          )}
        </div>
        <div
          className={styles.card}
          onClick={handleCardClick}
          onMouseDown={handleCardMouseDown}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          role="button"
          tabIndex={0}
          {...{ [SIDEBAR_CARD_DATA_ATTR]: id }}
          aria-label={t('query-editor-next.sidebar.card-click', 'Select card {{id}}', { id })}
          aria-pressed={isSelected}
        >
          <div className={styles.cardContent}>{children}</div>
          {hasActions && !multiSelectMode && (
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
      </div>
      {/* The inline add button is absolutely positioned into the left gutter, which the bulk
          checkbox occupies in multi-select mode. Hide it there to avoid the visual collision. */}
      {!multiSelectMode && <AddCardButton variant={addVariant} afterId={id} />}
    </div>
  );
};

function getStyles(
  theme: GrafanaTheme2,
  {
    isSelected,
    item,
  }: {
    isSelected?: boolean;
    item: ActionItem;
  }
) {
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
    paddingLeft: theme.spacing(3),
    borderRadius: `0 ${theme.shape.radius.default} ${theme.shape.radius.default} 0`,
    background: `linear-gradient(270deg, ${hoverSolidBg} 80%, transparent 100%)`,
    opacity: 0,
    transform: 'translateX(8px)',
    pointerEvents: 'none',
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['opacity', 'transform'], {
        duration: theme.transitions.duration.standard,
      }),
    },
  });

  const cardBorder = !!item.error
    ? `1px solid ${theme.colors.error.border}`
    : `1px solid ${isSelected ? borderColor : theme.colors.border.medium}`;

  const cardBackground = isSelected ? selectedBg : theme.colors.background.primary;
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

      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: `calc(-1 * ${theme.spacing(3.5)})`,
        width: theme.spacing(3.5),
        height: `calc(100% + ${theme.spacing(1.5)})`,
      },

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
      flex: 1,
      minWidth: 0,
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
        ...getHiddenMaskStyles(theme),
        boxShadow: 'none',
      }),

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
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['opacity'], {
          duration: theme.transitions.duration.standard,
        }),
      },
    }),

    cardRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1.25),
    }),

    // Animated slot: width opens/closes to slide the card aside. overflow:hidden
    // clips the box when closed; alignSelf:stretch lets the hit area fill card height.
    checkboxWrapper: css({
      display: 'flex',
      alignItems: 'stretch',
      alignSelf: 'stretch',
      overflow: 'hidden',
      width: 0,
      flexShrink: 0,
      lineHeight: 0,
      marginRight: `-${theme.spacing(1.25)}`,
      [theme.transitions.handleMotion('no-preference')]: {
        transition: theme.transitions.create(['width', 'margin-left', 'margin-right'], {
          duration: theme.transitions.duration.short,
          easing: theme.transitions.easing.easeOut,
        }),
      },
    }),
    checkboxWrapperOpen: css({
      width: theme.spacing(CHECKBOX_SLOT_OPEN_WIDTH),
      marginLeft: `-${theme.spacing(CHECKBOX_HIT_PADDING)}`,
      marginRight: `-${theme.spacing(CHECKBOX_HIT_PADDING)}`,
    }),

    checkboxClickArea: css({
      display: 'flex',
      alignItems: 'stretch',
    }),

    // Enlarges the click target (the Checkbox <label>) to the full card height and a
    // few px beyond the box on each side, with hover + press/check feedback.
    checkboxHitArea: css({
      height: '100%',
      alignContent: 'center',
      paddingInline: theme.spacing(CHECKBOX_HIT_PADDING),
      cursor: 'pointer',

      '& input': {
        cursor: 'pointer',
      },

      '&:hover input:not(:checked) + span': {
        borderColor: theme.components.input.borderHover,
      },

      [theme.transitions.handleMotion('no-preference')]: {
        '&:active input + span': {
          transform: 'scale(0.94)',
        },
        '& input:checked + span': {
          animation: `${checkboxPop} 180ms ${theme.transitions.easing.easeOut}`,
        },
        '& input:checked + span::after': {
          animation: `${checkboxTickIn} 180ms ${theme.transitions.easing.easeOut}`,
        },
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
