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

interface AddCardButtonProps {
  /** The refId of the card this button belongs to; new items are inserted after it. */
  afterRefId: string;
}

export const AddCardButton = ({ afterRefId }: AddCardButtonProps) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const { addQuery } = useActionsContext();
  const { setSelectedQuery, setPendingExpression } = useQueryEditorUIContext();
  const { openDrawer, queryLibraryEnabled } = useQueryLibraryContext();

  const [menuOpen, setMenuOpen] = useState(false);

  // When the savedQueriesRBAC feature toggle is enabled, access to the query
  // library is governed by fine-grained RBAC permissions. Otherwise, any
  // signed-in user can read saved queries (the pre-RBAC default).
  const canReadQueries = grafanaConfig.featureToggles.savedQueriesRBAC
    ? contextSrv.hasPermission(AccessControlAction.QueriesRead)
    : contextSrv.isSignedIn;

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

  const handleMenuVisibleChange = useCallback((visible: boolean) => {
    setMenuOpen(visible);
  }, []);

  const menu = useMemo(
    () => (
      <Menu>
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
          onClick={() => {
            setPendingExpression({ insertAfter: afterRefId });
          }}
        />
      </Menu>
    ),
    [addAndSelect, canReadQueries, openDrawer, queryLibraryEnabled, setPendingExpression, afterRefId]
  );

  return (
    <Dropdown
      overlay={menu}
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
