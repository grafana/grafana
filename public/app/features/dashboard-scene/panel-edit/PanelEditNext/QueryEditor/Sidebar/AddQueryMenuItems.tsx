import { CoreApp } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Menu, Tooltip } from '@grafana/ui';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { hasSavedQueryReadPermissions } from 'app/features/explore/QueryLibrary/utils/identity';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';

import {
  type AddCardSource,
  trackAddExpressionInitiated,
  trackAddQuery,
  trackOpenSavedQueryPicker,
} from '../../tracking';
import { useDatasourceContext, useQueryEditorUIContext } from '../QueryEditorContext';

import { getCardSource, useAddAndSelectQuery, useAddNewQuery } from './useAddCardActions';

interface AddQueryMenuItemsProps {
  afterId?: string;
  onAdd?: () => void;
  /** Defaults to 'inline' with an afterId, 'section_header' without. */
  source?: AddCardSource;
}

export function AddQueryMenuItems({ afterId, onAdd, source }: AddQueryMenuItemsProps) {
  const cardSource = source ?? getCardSource(afterId);
  const { dsSettings } = useDatasourceContext();
  const { setPendingExpression, setPendingSavedQuery } = useQueryEditorUIContext();
  const { openDrawer, queryLibraryEnabled } = useQueryLibraryContext();
  const addAndSelectQuery = useAddAndSelectQuery(afterId, onAdd);
  const addNewQuery = useAddNewQuery(afterId, onAdd, cardSource);

  const isDashboardDs = dsSettings?.name === SHARED_DASHBOARD_QUERY;
  const canReadQueries = hasSavedQueryReadPermissions();

  return (
    <>
      <Menu.Item
        label={t('query-editor-next.sidebar.add-query', 'Add query')}
        icon="question-circle"
        onClick={addNewQuery}
      />
      {queryLibraryEnabled && canReadQueries && (
        <Menu.Item
          label={t('query-editor-next.sidebar.add-saved-query', 'Add saved query')}
          icon="book-open"
          onClick={() => {
            trackOpenSavedQueryPicker(cardSource);
            setPendingSavedQuery({ insertAfter: afterId ?? '' });
            onAdd?.();
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
            trackAddExpressionInitiated(cardSource);
            setPendingExpression({ insertAfter: afterId ?? '' });
            onAdd?.();
          }}
        />
      )}
    </>
  );
}
