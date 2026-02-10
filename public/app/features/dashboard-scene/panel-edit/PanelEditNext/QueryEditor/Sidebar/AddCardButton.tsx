import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { CoreApp, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config as grafanaConfig } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Dropdown, Icon, Menu, useStyles2, useTheme2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { dataSource as expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { ExpressionQueryType, expressionTypes } from 'app/features/expressions/types';
import { getDefaults } from 'app/features/expressions/utils/expressionTypes';
import { AccessControlAction } from 'app/types/accessControl';

import { EXPRESSION_ICON_MAP } from '../../constants';
import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

function isExpressionType(
  item: SelectableValue<ExpressionQueryType>
): item is SelectableValue<ExpressionQueryType> & { value: ExpressionQueryType } {
  return typeof item.value === 'string' && item.value in EXPRESSION_ICON_MAP;
}

/** The various menus when adding a card. */
type MenuView = 'main' | 'expressionTypes';

interface AddCardButtonProps {
  /** The refId of the card this button belongs to; new items are inserted after it. */
  afterRefId: string;
}

/**
 * A plus ("+") icon button with dropdown menu for adding queries, saved
 * queries, or expressions below a given card in the sidebar.
 */
export const AddCardButton = ({ afterRefId }: AddCardButtonProps) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const { addQuery } = useActionsContext();
  const { setSelectedQuery } = useQueryEditorUIContext();
  const { openDrawer, queryLibraryEnabled } = useQueryLibraryContext();

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>('main');

  // Fcuses the expressions submenu as soon as it mounts so keyboard
  // navigation (arrow keys) works as expected.
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
      const newRefId = addQuery(query, afterRefId);
      if (newRefId) {
        const selectTarget: DataQuery = { refId: newRefId, hide: false };
        setSelectedQuery(selectTarget);
      }
    },
    [addQuery, afterRefId, setSelectedQuery]
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

  return (
    <Dropdown
      overlay={menus[menuView]}
      placement="right-start"
      offset={[theme.spacing.gridSize, 0]}
      onVisibleChange={handleMenuVisibleChange}
    >
      <button
        className={styles.button}
        data-add-button
        data-menu-open={menuOpen || undefined}
        type="button"
        aria-label={t('query-editor-next.sidebar.add-below', 'Add below {{id}}', { id: afterRefId })}
      >
        <Icon name="plus" size="md" />
      </button>
    </Dropdown>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    button: css({
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
  };
}
