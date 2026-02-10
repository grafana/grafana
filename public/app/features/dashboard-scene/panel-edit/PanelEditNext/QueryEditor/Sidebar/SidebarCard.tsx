import { css, cx } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { CoreApp, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config as grafanaConfig } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Dropdown, Icon, Menu, Stack, Text, useStyles2, useTheme2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { dataSource as expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { ExpressionQueryType, expressionTypes } from 'app/features/expressions/types';
import { getDefaults } from 'app/features/expressions/utils/expressionTypes';
import { AccessControlAction } from 'app/types/accessControl';

import { QueryEditorTypeConfig } from '../../constants';
import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

import { HoverActions } from './HoverActions';

const EXPRESSION_ICON_MAP = {
  [ExpressionQueryType.math]: 'calculator-alt',
  [ExpressionQueryType.reduce]: 'compress-arrows',
  [ExpressionQueryType.resample]: 'sync',
  [ExpressionQueryType.classic]: 'cog',
  [ExpressionQueryType.threshold]: 'sliders-v-alt',
  [ExpressionQueryType.sql]: 'database',
} as const satisfies Record<ExpressionQueryType, string>;

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

function isExpressionType(
  item: SelectableValue<ExpressionQueryType>
): item is SelectableValue<ExpressionQueryType> & { value: ExpressionQueryType } {
  return typeof item.value === 'string' && item.value in EXPRESSION_ICON_MAP;
}

/**
 * The various menu views for the sidebar card.
 */
type MenuView = 'main' | 'expressionTypes';

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
  const styles = useStyles2(getStyles, { config, isSelected });
  const theme = useTheme2();
  const typeText = config.getLabel();
  const { addQuery } = useActionsContext();
  const { setSelectedQuery } = useQueryEditorUIContext();
  const { openDrawer, queryLibraryEnabled } = useQueryLibraryContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>('main');

  // Callback ref: focuses the submenu as soon as it mounts so keyboard
  // navigation (arrow keys) works immediately. FloatingFocusManager only
  // handles focus on the initial Dropdown open, not on content swaps.
  const focusOnMount = useCallback((el: HTMLDivElement | null) => el?.focus(), []);

  // When the savedQueriesRBAC feature toggle is enabled, access to the query
  // library is governed by fine-grained RBAC permissions. Otherwise, any
  // signed-in user can read saved queries (the pre-RBAC default).
  const canReadQueries = grafanaConfig.featureToggles.savedQueriesRBAC
    ? contextSrv.hasPermission(AccessControlAction.QueriesRead)
    : contextSrv.isSignedIn;

  /** Add a query after this card and auto-select it in the sidebar. */
  const addAndSelect = useCallback(
    (query?: Partial<DataQuery>) => {
      const newRefId = addQuery(query, id);
      if (newRefId) {
        // `setSelectedQuery` only needs a `refId` to identify the query;
        // the full `DataQuery` will be resolved from the queries array.
        const selectTarget: DataQuery = { refId: newRefId, hide: false };
        setSelectedQuery(selectTarget);
      }
    },
    [addQuery, id, setSelectedQuery]
  );

  /** Create an expression of a certain type and add it. */
  const addExpressionOfType = useCallback(
    (type: ExpressionQueryType) => {
      const baseQuery = expressionDatasource.newQuery();
      const queryWithType = { ...baseQuery, type };
      const queryWithDefaults = getDefaults(queryWithType);
      addAndSelect(queryWithDefaults);
    },
    [addAndSelect]
  );

  /** Reset the menu to the main view when it closes. */
  const handleMenuVisibleChange = useCallback((visible: boolean) => {
    setMenuOpen(visible);
    if (!visible) {
      setMenuView('main');
    }
  }, []);

  const menus: Record<MenuView, React.ReactElement> = useMemo(
    () => ({
      main: (
        <Menu key="main">
          <Menu.Item
            label={t('query-editor-next.sidebar.add-query', 'Add query')}
            icon="question-circle"
            onClick={() => addAndSelect()}
          />
          {queryLibraryEnabled && canReadQueries && (
            <Menu.Item
              label={t('query-editor-next.sidebar.add-saved-query', 'Add saved query')}
              icon="book-open"
              onClick={() =>
                openDrawer({
                  onSelectQuery: (query) => addAndSelect(query),
                  options: { context: CoreApp.PanelEditor },
                })
              }
            />
          )}
          <Menu.Item
            label={t('query-editor-next.sidebar.add-expression', 'Add expression')}
            icon="calculator-alt"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuView('expressionTypes');
            }}
          />
        </Menu>
      ),
      expressionTypes: (
        <Menu key="expressionTypes" ref={focusOnMount}>
          <Menu.Item
            label={t('query-editor-next.sidebar.back', 'Back')}
            icon="arrow-left"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuView('main');
            }}
          />
          <Menu.Divider />
          {expressionTypes.filter(isExpressionType).map((item) => (
            <Menu.Item
              key={item.value}
              label={item.label ?? ''}
              icon={EXPRESSION_ICON_MAP[item.value]}
              onClick={() => addExpressionOfType(item.value)}
            />
          ))}
        </Menu>
      ),
    }),
    [addAndSelect, addExpressionOfType, canReadQueries, focusOnMount, openDrawer, queryLibraryEnabled]
  );

  const addMenu = menus[menuView];

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
          <div className={styles.cardContent}>{children}</div>
        </div>
        <Dropdown
          overlay={addMenu}
          placement="right-start"
          offset={[theme.spacing.gridSize, 0]} // nudge the menu to the right, for a little space between the "+" button and the menu
          onVisibleChange={handleMenuVisibleChange}
        >
          <button
            className={styles.addButton}
            data-add-button
            data-menu-open={menuOpen || undefined}
            type="button"
            aria-label={t('query-editor-next.sidebar.add-below', 'Add below {{id}}', { id })}
          >
            <Icon name="plus" size="md" />
          </button>
        </Dropdown>
      </div>
    </div>
  );
};

function getStyles(
  theme: GrafanaTheme2,
  { config, isSelected }: { config: QueryEditorTypeConfig; isSelected?: boolean }
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

      // Two slim pseudo-element strips extend the hover zone to the left and
      // below the card, covering the path to the "+" button without overlapping
      // the card's own clickable surface (which would interfere with selecting
      // the query card).

      // Left strip: narrow gutter running along the card's left edge and below.
      '&::before': {
        content: '""',
        position: 'absolute',
        top: '0%',
        left: `calc(-1 * ${theme.spacing(1.5)})`,
        width: theme.spacing(1.5),
        height: `calc(100% + ${theme.spacing(1.5)})`,
        // background: 'hsla(333, 83%, 33%, 0.5)', // uncomment to debug hover zone
      },

      // Bottom strip: runs along the card's bottom edge extending to the left.
      '&::after': {
        content: '""',
        position: 'absolute',
        top: '100%',
        left: `calc(-1 * ${theme.spacing(1.5)})`,
        width: `calc(100% + ${theme.spacing(1.5)})`,
        height: theme.spacing(1.5),
        // background: 'hsla(333, 83%, 33%, 0.5)', // uncomment to debug hover zone
      },

      '&:hover': {
        zIndex: 1,
      },

      // Show add button on hover, or when its dropdown menu is open
      '&:hover [data-add-button], [data-menu-open]': {
        opacity: 1,
        pointerEvents: 'auto',
      },
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
    addButton: css({
      position: 'absolute',
      top: 'calc(100%)',
      left: 0,
      transform: 'translate(-100%, 0)',
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: theme.spacing(2),
      height: theme.spacing(2),
      borderRadius: theme.shape.radius.sm,
      border: 'none',
      background: theme.colors.primary.main,
      color: theme.colors.primary.contrastText,
      cursor: 'pointer',
      padding: 0,
      opacity: 0,
      pointerEvents: 'none',

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['opacity', 'background-color'], {
          duration: theme.transitions.duration.short,
        }),
      },

      '&:hover': {
        background: theme.colors.primary.shade,
      },

      '&:focus-visible': {
        opacity: 1,
        pointerEvents: 'auto',
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
