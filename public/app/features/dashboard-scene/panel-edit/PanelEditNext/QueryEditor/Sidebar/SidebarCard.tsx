import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { QUERY_EDITOR_TYPE_HAS_ADD_BUTTON, QueryEditorTypeConfig } from '../../constants';

import { AddCardButton } from './AddCardButton';
import { HoverActions } from './HoverActions';

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
}: SidebarCardProps) => {
  const hasAddButton = QUERY_EDITOR_TYPE_HAS_ADD_BUTTON[config.__type__];
  const styles = useStyles2(getStyles, { config, isSelected, hasAddButton });
  const typeText = config.getLabel();

  // Using a div with role="button" instead of a native button for @hello-pangea/dnd compatibility,
  // so we manually handle Enter and Space key activation.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div className={styles.wrapper}>
      <div
        className={cx(styles.card, { [styles.hidden]: isHidden })}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={t('query-editor-next.sidebar.card-click', 'Select card {{id}}', { id })}
        aria-pressed={isSelected}
      >
        <div className={styles.cardHeader}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Icon name={config.icon} />
            <Text weight="light" variant="body">
              {typeText}
            </Text>
          </Stack>
          <div className={styles.hoverActions}>
            <HoverActions
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onToggleHide={onToggleHide}
              isHidden={isHidden}
            />
          </div>
        </div>
        <div className={styles.cardContent}>{children}</div>
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
    opacity: 0,
    marginLeft: 'auto',

    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['opacity'], {
        duration: theme.transitions.duration.short,
      }),
    },
  });

  return {
    wrapper: css({
      position: 'relative',
      marginInline: theme.spacing(2),

      // The hover-zone pseudo-elements and add-button visibility rules are
      // only needed when the card has an AddCardButton.
      ...(hasAddButton && {
        // Two slim pseudo-element strips extend the hover zone to the left and
        // below the card, covering the path to the "+" button without overlapping
        // the card's clickable area.

        // Left strip: narrow gutter running along the card's left edge and below.
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: `calc(-1 * ${theme.spacing(1.5)})`,
          width: theme.spacing(1.5),
          height: `calc(100% + ${theme.spacing(1.5)})`,
        },

        // Bottom strip: runs along the card's bottom edge extending to the left.
        '&::after': {
          content: '""',
          position: 'absolute',
          top: '100%',
          left: `calc(-1 * ${theme.spacing(1.5)})`,
          width: `calc(100% + ${theme.spacing(1.5)})`,
          height: theme.spacing(1.5),
        },

        '&:hover': {
          zIndex: 1,
        },

        '&:hover [data-add-button], [data-menu-open]': {
          opacity: 1,
          pointerEvents: 'auto',
        },
      }),
    }),
    card: css({
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      background: isSelected ? theme.colors.action.selected : theme.colors.background.secondary,
      border: `1px solid ${isSelected ? theme.colors.primary.border : theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      padding: 0,
      boxShadow: isSelected ? `0 0 9px 0 rgba(58, 139, 255, 0.3)` : 'none',

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background-color'], {
          duration: theme.transitions.duration.short,
        }),
      },

      '&:hover': {
        background: isSelected
          ? theme.colors.action.selected
          : theme.colors.emphasize(theme.colors.background.secondary, 0.03),
        borderColor: isSelected ? theme.colors.primary.border : theme.colors.border.medium,
      },

      [`&:hover .${hoverActions}`]: {
        opacity: 1,
      },

      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.border}`,
        outlineOffset: '2px',
      },
    }),
    cardHeader: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
      background: theme.colors.background.primary,
      color: config.color,
      borderTopRightRadius: theme.shape.radius.default,
      borderTopLeftRadius: theme.shape.radius.default,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    hoverActions,
    cardContent: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
    }),

    hidden: css({
      opacity: 0.6,
    }),
  };
}
