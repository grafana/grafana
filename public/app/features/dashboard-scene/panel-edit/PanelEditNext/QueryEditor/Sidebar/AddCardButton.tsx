import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { CoreApp, GrafanaTheme2, standardTransformersRegistry } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config as grafanaConfig } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Dropdown, Icon, Menu, useStyles2, useTheme2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { AccessControlAction } from 'app/types/accessControl';

import { QUERY_EDITOR_COLORS } from '../../constants';
import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

interface AddCardButtonProps {
  /** What kind of item to add. Determines the menu contents. Default: 'query'. */
  variant?: 'query' | 'transformation';
  /** Insert position. For 'query' variant this is a refId; for 'transformation' it is a transformId.
      When omitted, the new item appends to the end of its section. */
  afterId?: string;
  /** When true, renders as an always-visible inline button (for section headings).
      When false/omitted, renders as the existing hover-to-show absolute-positioned button. */
  alwaysVisible?: boolean;
}

export const AddCardButton = ({ variant = 'query', afterId, alwaysVisible = false }: AddCardButtonProps) => {
  const styles = useStyles2(getStyles, { alwaysVisible, variant });
  const theme = useTheme2();
  const { addQuery, addTransformation } = useActionsContext();
  const { setSelectedQuery, setPendingExpression } = useQueryEditorUIContext();
  const { openDrawer, queryLibraryEnabled } = useQueryLibraryContext();

  const [menuOpen, setMenuOpen] = useState(false);

  // When the savedQueriesRBAC feature toggle is enabled, access to the query
  // library is governed by fine-grained RBAC permissions. Otherwise, any
  // signed-in user can read saved queries (the pre-RBAC default).
  const canReadQueries = grafanaConfig.featureToggles.savedQueriesRBAC
    ? contextSrv.hasPermission(AccessControlAction.QueriesRead)
    : contextSrv.isSignedIn;

  const addAndSelectQuery = useCallback(
    (query?: Partial<DataQuery>) => {
      const newRefId = addQuery(query, afterId);
      if (newRefId) {
        const selectTarget: DataQuery = { refId: newRefId, hide: false };
        setSelectedQuery(selectTarget);
      }
    },
    [addQuery, afterId, setSelectedQuery]
  );

  const handleMenuVisibleChange = useCallback((visible: boolean) => {
    setMenuOpen(visible);
  }, []);

  const queryMenu = useMemo(
    () => (
      <Menu>
        <Menu.Item
          label={t('query-editor-next.sidebar.add-query', 'Add query')}
          icon="question-circle"
          onClick={() => addAndSelectQuery()}
        />
        {queryLibraryEnabled && canReadQueries && (
          <Menu.Item
            label={t('query-editor-next.sidebar.add-saved-query', 'Add saved query')}
            icon="book-open"
            onClick={() =>
              openDrawer({
                onSelectQuery: (query) => addAndSelectQuery(query),
                options: { context: CoreApp.PanelEditor },
              })
            }
          />
        )}
        <Menu.Item
          label={t('query-editor-next.sidebar.add-expression', 'Add expression')}
          icon="calculator-alt"
          onClick={() => {
            setPendingExpression({ insertAfter: afterId ?? '' });
          }}
        />
      </Menu>
    ),
    [addAndSelectQuery, canReadQueries, openDrawer, queryLibraryEnabled, setPendingExpression, afterId]
  );

  const transformationMenu = useMemo(() => {
    const collator = new Intl.Collator();
    const allTransformations = standardTransformersRegistry.list().sort((a, b) => collator.compare(a.name, b.name));

    return (
      <Menu>
        {allTransformations.map((item) => (
          <Menu.Item key={item.id} label={item.name} onClick={() => addTransformation(item.id, afterId)} />
        ))}
      </Menu>
    );
  }, [addTransformation, afterId]);

  const menu = variant === 'transformation' ? transformationMenu : queryMenu;

  const ariaLabel =
    variant === 'transformation'
      ? afterId
        ? t('query-editor-next.sidebar.add-transformation-below', 'Add transformation below {{id}}', { id: afterId })
        : t('query-editor-next.sidebar.add-transformation', 'Add transformation')
      : afterId
        ? t('query-editor-next.sidebar.add-below', 'Add below {{id}}', { id: afterId })
        : t('query-editor-next.sidebar.add-query-or-expression', 'Add query or expression');

  return (
    <Dropdown
      overlay={menu}
      placement={alwaysVisible ? 'bottom-start' : 'right-start'}
      offset={alwaysVisible ? [0, theme.spacing.gridSize * 0.5] : [theme.spacing.gridSize, 0]}
      onVisibleChange={handleMenuVisibleChange}
    >
      <button
        className={styles.button}
        data-add-button={!alwaysVisible || undefined}
        data-menu-open={menuOpen || undefined}
        type="button"
        aria-label={ariaLabel}
        onClick={alwaysVisible ? (e) => e.stopPropagation() : undefined}
      >
        <Icon name="plus" size={alwaysVisible ? 'sm' : 'md'} />
      </button>
    </Dropdown>
  );
};

function getStyles(
  theme: GrafanaTheme2,
  { alwaysVisible, variant }: { alwaysVisible: boolean; variant: 'query' | 'transformation' }
) {
  if (alwaysVisible) {
    const bgColor = variant === 'transformation' ? QUERY_EDITOR_COLORS.transformation : QUERY_EDITOR_COLORS.query;

    return {
      button: css({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: theme.spacing(2),
        height: theme.spacing(2),
        borderRadius: theme.shape.radius.sm,
        border: 'none',
        background: bgColor,
        color: theme.colors.text.maxContrast,
        cursor: 'pointer',
        padding: 0,

        '&:hover': {
          filter: 'brightness(1.2)',
        },

        '&:focus-visible': {
          outline: `2px solid ${theme.colors.primary.border}`,
          outlineOffset: '2px',
        },
      }),
    };
  }

  return {
    button: css({
      position: 'absolute',
      top: `calc(100% + ${theme.spacing(0.25)})`,
      left: theme.spacing(-2.5),
      transform: 'translateY(-50%)',
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
