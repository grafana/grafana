import { css, cx } from '@emotion/css';
import { useCallback, useState } from 'react';

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
  const [hasFocusWithin, setHasFocusWithin] = useState(false);

  const handleFocus = useCallback(() => {
    setHasFocusWithin(true);
  }, []);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) {
      setHasFocusWithin(false);
    }
  }, []);

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
        onFocus={handleFocus}
        onBlur={handleBlur}
        role="button"
        tabIndex={0}
        aria-label={t('query-editor-next.sidebar.card-click', 'Select card {{id}}', { id })}
        aria-pressed={isSelected}
      >
        <div className={cx(styles.cardContent, { [styles.hidden]: isHidden })}>{children}</div>
        <div className={cx(styles.hoverActions, { [styles.hoverActionsVisible]: hasFocusWithin })}>
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
  const backgroundColor = isSelected ? QUERY_EDITOR_COLORS.card.activeBg : QUERY_EDITOR_COLORS.card.hoverBg;
  const hoverActions = css({
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: theme.spacing(1),
    // increasing the left padding lets the gradient become transparent before the first button rather than behind the first button
    paddingLeft: theme.spacing(2),
    background: `linear-gradient(270deg, ${backgroundColor} 90%, rgba(32, 38, 47, 0.00) 100%)`,
    opacity: 0,
    transform: 'translateX(8px)',
    pointerEvents: 'none',

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
          // background: 'red',
        },
        // Area around button: covers the gap between cards horizontally to the button.
        '&::after': {
          content: '""',
          position: 'absolute',
          top: '100%',
          left: `calc(-1 * ${theme.spacing(1.5)})`,
          width: `calc(100% + ${theme.spacing(1.5)})`,
          height: theme.spacing(0.5),
          //background: 'red',
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
      borderLeft: `${isSelected ? 3 : 1}px solid ${config.color}`,
      cursor: 'pointer',
      padding: 0,

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background-color'], {
          duration: theme.transitions.duration.short,
        }),
      },
      '&:hover': {
        background: backgroundColor,
      },
      [`&:hover .${hoverActions}`]: {
        opacity: 1,
        transform: 'translateX(0)',
        pointerEvents: 'auto',
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
      padding: theme.spacing(0.5, 1),
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
