import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { Actions } from '../../Actions';
import { QUERY_EDITOR_COLORS, QueryEditorTypeConfig } from '../../constants';

import { AddCardButton } from './AddCardButton';

interface SidebarCardProps {
  config: QueryEditorTypeConfig;
  isSelected: boolean;
  id: string;
  children: React.ReactNode;
  onClick: () => void;
  onDuplicate?: () => void;
  onDelete: () => void;
  onToggleHide: () => void;
  isHidden: boolean;
  showAddButton: boolean;
}

export const SidebarCard = ({
  config,
  isSelected,
  id,
  children,
  onClick,
  onDuplicate,
  onDelete,
  onToggleHide,
  isHidden,
  showAddButton = true,
}: SidebarCardProps) => {
  const hasAddButton = showAddButton;
  const styles = useStyles2(getStyles, { config, isSelected, hasAddButton });
  const typeText = config.getLabel();

  // Using a div with role="button" instead of a native button for @hello-pangea/dnd compatibility,
  // so we manually handle Enter and Space key activation.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) {
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.card}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={t('query-editor-next.sidebar.card-click', 'Select card {{id}}', { id })}
        aria-pressed={isSelected}
      >
        <div className={cx(styles.cardContent, { [styles.hidden]: isHidden })}>{children}</div>
        <div className={styles.hoverActions}>
          <Actions
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onToggleHide={onToggleHide}
            isHidden={isHidden}
            typeLabel={typeText}
          />
        </div>
      </div>
      {hasAddButton && <AddCardButton afterRefId={id} />}
    </div>
  );
};

function getStyles(
  theme: GrafanaTheme2,
  { config, isSelected, hasAddButton }: { config: QueryEditorTypeConfig; isSelected?: boolean; hasAddButton?: boolean }
) {
  const hoverActions = css({
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: theme.spacing(1),
    // this will never actually show up other than when the card is hovered so we only need the hoverBg
    background: `linear-gradient(270deg, ${QUERY_EDITOR_COLORS.card.hoverBg} 72%, rgba(32, 38, 47, 0.00) 100%)`,
    opacity: 0,
    transform: 'translateX(8px)',
    pointerEvents: 'none',
    width: '87px',

    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['opacity', 'transform'], {
        duration: theme.transitions.duration.complex,
      }),
    },
  });

  return {
    wrapper: css({
      position: 'relative',
      marginInlineStart: theme.spacing(2),

      // The hover-zone pseudo-elements extend the hover area to cover the
      // centered add button between cards, making it easier to discover and access.
      ...(hasAddButton && {
        // Left strip: narrow gutter running along the card's left edge and extending
        // through the gap to the next card, covering the path to the centered "+" button.
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: `calc(-1 * ${theme.spacing(1.5)})`,
          width: theme.spacing(1.5),
          height: `calc(100% + ${theme.spacing(0.5)})`,
        },

        // Area around button: covers the gap between cards horizontally to the button.
        '&::after': {
          content: '""',
          position: 'absolute',
          top: '100%',
          left: `calc(-1 * ${theme.spacing(1.5)})`,
          width: `calc(100% + ${theme.spacing(1.5)})`,
          height: theme.spacing(0.5),
        },

        '&:hover': {
          zIndex: 1,
        },

        '&:hover [data-add-button], & [data-menu-open]': {
          opacity: 1,
          pointerEvents: 'auto',
        },
      }),
    }),
    card: css({
      position: 'relative',
      minHeight: '30px',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      background: isSelected ? QUERY_EDITOR_COLORS.card.activeBg : 'none',
      // border: `1px solid ${isSelected ? theme.colors.primary.border : theme.colors.border.weak}`,
      borderLeft: `${isSelected ? 2 : 1}px solid ${config.color}`,
      // borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      padding: 0,
      // boxShadow: isSelected ? `0 0 9px 0 rgba(58, 139, 255, 0.3)` : 'none',

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background-color'], {
          duration: theme.transitions.duration.short,
        }),
      },

      '&:hover': {
        background: QUERY_EDITOR_COLORS.card.hoverBg,
        // borderColor: isSelected ? theme.colors.primary.border : theme.colors.border.medium,
      },

      [`&:hover .${hoverActions}`]: {
        background: `linear-gradient(270deg, ${QUERY_EDITOR_COLORS.card.hoverBg} 90%, rgba(32, 38, 47, 0.00) 100%)`,
        opacity: 1,
        transform: 'translateX(0)',
        pointerEvents: 'auto',
      },

      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.border}`,
        outlineOffset: '2px',
      },
    }),
    hoverActions,
    cardContent: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: `4px 8px`,
      overflow: 'hidden',
      minWidth: 0,
      flex: 1,

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['opacity'], {
          duration: theme.transitions.duration.short,
        }),
      },
    }),
    hidden: css({
      opacity: 0.7,
    }),
  };
}
