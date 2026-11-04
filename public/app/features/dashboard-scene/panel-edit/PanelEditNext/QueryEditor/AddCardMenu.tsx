import { useCallback } from 'react';

import { CoreApp } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';
import { Menu, Tooltip } from '@grafana/ui';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { hasSavedQueryReadPermissions } from 'app/features/explore/QueryLibrary/utils/identity';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';

import { QueryEditorType } from '../constants';
import {
  type AddCardSource,
  trackAddExpressionInitiated,
  trackAddQuery,
  trackAddTransformationInitiated,
  trackOpenSavedQueryPicker,
} from '../tracking';

import {
  useActionsContext,
  useDatasourceContext,
  useQueryEditorTypeConfig,
  useQueryEditorUIContext,
} from './QueryEditorContext';

interface AddCardMenuProps {
  afterId?: string;
  source: AddCardSource;
  /** Adds a trailing divider + "Add transformation" that appends to the end of the list. */
  showAddTransformation?: boolean;
  onAdd?: () => void;
}

export function AddCardMenu({ afterId, source, showAddTransformation = false, onAdd }: AddCardMenuProps) {
  const typeConfig = useQueryEditorTypeConfig();
  const { dsSettings } = useDatasourceContext();
  const { addQuery } = useActionsContext();
  const { setSelectedQuery, setPendingExpression, setPendingTransformation, setPendingSavedQuery } =
    useQueryEditorUIContext();
  const { openDrawer, queryLibraryEnabled } = useQueryLibraryContext();

  const isDashboardDs = dsSettings?.name === SHARED_DASHBOARD_QUERY;
  const canReadQueries = hasSavedQueryReadPermissions();

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

  return (
    <Menu>
      <Menu.Item
        label={t('query-editor-next.sidebar.add-query', 'Add query')}
        icon="question-circle"
        onClick={() => {
          trackAddQuery('new_query', source);
          addAndSelectQuery();
        }}
      />
      {queryLibraryEnabled && canReadQueries && (
        <Menu.Item
          label={t('query-editor-next.sidebar.add-saved-query', 'Add saved query')}
          icon="book-open"
          onClick={() => {
            trackOpenSavedQueryPicker(source);
            setPendingSavedQuery({ insertAfter: afterId ?? '' });
            openDrawer({
              onSelectQuery: (query) => {
                trackAddQuery('saved_query', source);
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
            trackAddExpressionInitiated(source);
            setPendingExpression({ insertAfter: afterId ?? '' });
            onAdd?.();
          }}
        />
      )}
      {showAddTransformation && (
        <>
          <Menu.Divider />
          <Menu.Item
            label={t('query-editor-next.sidebar.add-transformation', 'Add transformation')}
            icon={typeConfig[QueryEditorType.Transformation].icon}
            onClick={() => {
              trackAddTransformationInitiated(source);
              // Transformations run after all queries, so there is no "after this query" position.
              setPendingTransformation({ insertAfter: undefined });
              onAdd?.();
            }}
          />
        </>
      )}
    </Menu>
  );
}
