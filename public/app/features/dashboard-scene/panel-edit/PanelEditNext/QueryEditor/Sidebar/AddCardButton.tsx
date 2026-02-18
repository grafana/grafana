import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { CoreApp, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config as grafanaConfig } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Dropdown, Icon, Menu, useStyles2, useTheme2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { AccessControlAction } from 'app/types/accessControl';

import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

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
}

export const AddCardButton = ({ variant, afterId, alwaysVisible = false }: AddCardButtonProps) => {
  const styles = useStyles2(getStyles, alwaysVisible);
  const theme = useTheme2();
  const { addQuery } = useActionsContext();
  const { setSelectedQuery, setPendingExpression, setPendingTransformation } = useQueryEditorUIContext();
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

  const handleTransformationClick = useCallback(() => {
    setPendingTransformation({ insertAfter: afterId });
  }, [afterId, setPendingTransformation]);

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
      width: theme.spacing(2),
      height: theme.spacing(2),
      borderRadius: theme.shape.radius.sm,
      border: 'none',
      background: theme.colors.primary.main,
      color: theme.colors.primary.contrastText,
      cursor: 'pointer',
      padding: 0,

      // Hover-button positioning & hidden-by-default state (revealed by SidebarCard hover)
      ...(!alwaysVisible && {
        position: 'absolute' as const,
        top: `calc(100% + ${theme.spacing(0.25)})`,
        left: theme.spacing(-2.5),
        transform: 'translateY(-50%)',
        zIndex: 1,
        opacity: 0,
        pointerEvents: 'none' as const,

        [theme.transitions.handleMotion('no-preference', 'reduce')]: {
          transition: theme.transitions.create(['opacity', 'background-color'], {
            duration: theme.transitions.duration.short,
          }),
        },
      }),

      '&:hover': {
        background: theme.colors.primary.shade,
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
