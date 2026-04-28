import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { CoreApp, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config as grafanaConfig } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { Dropdown, Icon, Menu, Tooltip } from '@grafana/ui';
import { useStyles2, useTheme2 } from '@grafana/ui/themes';
import { contextSrv } from 'app/core/services/context_srv';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';
import { AccessControlAction } from 'app/types/accessControl';

import {
  trackAddExpressionInitiated,
  trackAddQuery,
  trackAddTransformationInitiated,
  trackOpenSavedQueryPicker,
} from '../../tracking';
import { useActionsContext, useDatasourceContext, useQueryEditorUIContext } from '../QueryEditorContext';

function getButtonAriaLabel(variant: 'query' | 'transformation', afterId?: string) {
  if (variant === 'transformation') {
    return afterId
      ? t('query-editor-next.sidebar.add-transformation-below', 'Add transformation below {{id}}', { id: afterId })
      : t('query-editor-next.sidebar.add-transformation', 'Add transformation');
  }

  return afterId
    ? t('query-editor-next.sidebar.add-below', 'Add below {{id}}', { id: afterId })
    : t('query-editor-next.sidebar.add-query-or-expression', 'Add query or expression');
}

interface AddCardButtonProps {
  variant: 'query' | 'transformation';
  afterId?: string;
  alwaysVisible?: boolean;
  onAdd?: () => void;
}

export const AddCardButton = ({ variant, afterId, onAdd, alwaysVisible = false }: AddCardButtonProps) => {
  const styles = useStyles2(getStyles, alwaysVisible);
  const theme = useTheme2();
  const { dsSettings } = useDatasourceContext();
  const { addQuery } = useActionsContext();
  const { setSelectedQuery, setPendingExpression, setPendingTransformation, setPendingSavedQuery } =
    useQueryEditorUIContext();
  const { openDrawer, queryLibraryEnabled } = useQueryLibraryContext();

  const [menuOpen, setMenuOpen] = useState(false);

  const isDashboardDs = dsSettings?.name === SHARED_DASHBOARD_QUERY;

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
        onAdd?.();
      }
    },
    [addQuery, afterId, setSelectedQuery, onAdd]
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
          onClick={() => {
            trackAddQuery('new_query', afterId ? 'inline' : 'section_header');
            addAndSelectQuery();
          }}
        />
        {queryLibraryEnabled && canReadQueries && (
          <Menu.Item
            label={t('query-editor-next.sidebar.add-saved-query', 'Add saved query')}
            icon="book-open"
            onClick={() => {
              const cardSource = afterId ? 'inline' : 'section_header';
              trackOpenSavedQueryPicker(cardSource);
              setPendingSavedQuery({ insertAfter: afterId ?? '' });
              openDrawer({
                onSelectQuery: (query) => {
                  trackAddQuery('saved_query', cardSource);
                  addAndSelectQuery(query);
                },
                options: { context: CoreApp.PanelEditor },
              });
            }}
          />
        )}
        {isDashboardDs ? (
          <Tooltip
            content={t(
              'query-editor-next.sidebar.add-expression-disabled',
              'Expressions are not supported with the Dashboard data source'
            )}
            placement="right"
          >
            <Menu.Item
              label={t('query-editor-next.sidebar.add-expression', 'Add expression')}
              icon="calculator-alt"
              disabled
            />
          </Tooltip>
        ) : (
          <Menu.Item
            label={t('query-editor-next.sidebar.add-expression', 'Add expression')}
            icon="calculator-alt"
            onClick={() => {
              trackAddExpressionInitiated(afterId ? 'inline' : 'section_header');
              setPendingExpression({ insertAfter: afterId ?? '' });
              onAdd?.();
            }}
          />
        )}
      </Menu>
    ),
    [
      queryLibraryEnabled,
      canReadQueries,
      isDashboardDs,
      addAndSelectQuery,
      setPendingSavedQuery,
      afterId,
      openDrawer,
      setPendingExpression,
      onAdd,
    ]
  );

  const handleTransformationClick = useCallback(() => {
    trackAddTransformationInitiated(afterId ? 'inline' : 'section_header');
    setPendingTransformation({ insertAfter: afterId });
    onAdd?.();
  }, [afterId, setPendingTransformation, onAdd]);

  const ariaLabel = getButtonAriaLabel(variant, afterId);

  if (variant === 'transformation') {
    return (
      <button
        className={styles.button}
        data-add-button={!alwaysVisible || undefined}
        type="button"
        aria-label={ariaLabel}
        onClick={handleTransformationClick}
      >
        <Icon name="plus" size={alwaysVisible ? 'sm' : 'md'} />
      </button>
    );
  }

  return (
    <Dropdown
      overlay={queryMenu}
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
      >
        <Icon name="plus" size={alwaysVisible ? 'sm' : 'md'} />
      </button>
    </Dropdown>
  );
};

function getStyles(theme: GrafanaTheme2, alwaysVisible: boolean) {
  return {
    button: css({
      display: alwaysVisible ? 'inline-flex' : 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: theme.spacing(2.5),
      height: theme.spacing(2.5),
      borderRadius: theme.shape.radius.sm,
      border: 'none',
      background: theme.colors.primary.main,
      color: theme.colors.primary.contrastText,
      cursor: 'pointer',
      padding: 0,
      willChange: 'transform',
      transform: alwaysVisible ? 'translateZ(0)' : 'translateY(-50%) translateZ(0)',

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: [
          theme.transitions.create(alwaysVisible ? ['background-color'] : ['opacity', 'background-color'], {
            duration: 100,
          }),
          'transform 250ms cubic-bezier(0.25, 1, 0.5, 1)',
        ].join(', '),
      },

      // Hover-button positioning & hidden-by-default state (revealed by SidebarCard hover)
      ...(!alwaysVisible && {
        position: 'absolute' as const,
        top: `calc(100% + ${theme.spacing(0.25)})`,
        left: theme.spacing(-2.5),
        zIndex: 1,
        opacity: 0,
        pointerEvents: 'none' as const,
      }),

      '&:hover': {
        background: theme.colors.primary.shade,
      },

      '&:active': {
        transform: alwaysVisible ? 'scale(0.97)' : 'translateY(-50%) scale(0.97)',
      },

      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.border}`,
        outlineOffset: '2px',
        ...(!alwaysVisible && {
          opacity: 1,
          pointerEvents: 'auto' as const,
        }),
      },
    }),
  };
}
