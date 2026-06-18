import { css } from '@emotion/css';
import { type ReactNode, useState } from 'react';

import { type DataSourceInstanceSettings, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { isExpressionReference } from '@grafana/runtime';
import { ConfirmModal, type IconName, Stack, useStyles2 } from '@grafana/ui';
import { DataSourceModal } from 'app/features/datasources/components/picker/DataSourceModal';

import {
  useActionsContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from '../QueryEditorContext';

interface BulkAction {
  key: string;
  icon: IconName;
  label: string;
  tooltip: string;
  destructive?: boolean;
  onClick: () => void;
}

export interface BulkActionGroup {
  key: string;
  actions: BulkAction[];
  modals: ReactNode;
}

interface DeleteConfirmDescriptionProps {
  items: Array<{ id: string; label: string }>;
}

// Lists exactly what will be deleted so the user can confirm the destructive action against the
// concrete set, rather than a bare count. Used by both the query and transformation modals.
function DeleteConfirmDescription({ items }: DeleteConfirmDescriptionProps) {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={1}>
      <ul className={styles.itemList}>
        {items.map(({ id, label }) => (
          <li key={id}>{label}</li>
        ))}
      </ul>
      <span>{t('query-editor-next.bulk-actions.delete-confirm-body', 'This action cannot be undone.')}</span>
    </Stack>
  );
}

export function useBulkQueryActions(): BulkActionGroup {
  const { selectedQueryRefIds, setMultiSelectMode } = useQueryEditorUIContext();
  const { bulkDeleteQueries, bulkToggleQueriesHide, bulkChangeDataSource } = useActionsContext();
  const { queries } = useQueryRunnerContext();

  const [showDsModal, setShowDsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const selectedRefIdSet = new Set(selectedQueryRefIds);
  const selectedQueries = queries.filter(({ refId }) => selectedRefIdSet.has(refId));
  const allHidden = selectedQueries.length > 0 && selectedQueries.every(({ hide }) => hide);
  const canChangeDatasource = selectedQueries.every(({ datasource }) => !isExpressionReference(datasource));

  const handleConfirmedDelete = () => {
    bulkDeleteQueries(selectedQueryRefIds);
    setShowDeleteConfirm(false);
    setMultiSelectMode(false);
  };

  const handleDatasourceChange = async (settings: DataSourceInstanceSettings) => {
    await bulkChangeDataSource(selectedQueryRefIds, settings);
    setShowDsModal(false);
  };

  const actions: BulkAction[] = [
    {
      key: 'delete',
      icon: 'trash-alt',
      destructive: true,
      label: t('query-editor-next.bulk-actions.delete', 'Delete'),
      tooltip: t('query-editor-next.bulk-actions.delete-tooltip', 'Delete selected'),
      onClick: () => setShowDeleteConfirm(true),
    },
    {
      key: 'toggle-hide',
      icon: allHidden ? 'eye-slash' : 'eye',
      label: allHidden
        ? t('query-editor-next.bulk-actions.show', 'Show')
        : t('query-editor-next.bulk-actions.hide', 'Hide'),
      tooltip: allHidden
        ? t('query-editor-next.bulk-actions.show-all-tooltip', 'Show selected')
        : t('query-editor-next.bulk-actions.hide-all-tooltip', 'Hide selected'),
      onClick: () => bulkToggleQueriesHide(selectedQueryRefIds, !allHidden),
    },
  ];

  if (canChangeDatasource) {
    actions.push({
      key: 'datasource',
      icon: 'database',
      label: t('query-editor-next.bulk-actions.datasource', 'Data source'),
      tooltip: t('query-editor-next.bulk-actions.change-datasource', 'Change data source for selected queries'),
      onClick: () => setShowDsModal(true),
    });
  }

  const modals = (
    <>
      {showDsModal && (
        <DataSourceModal
          current={null}
          onChange={handleDatasourceChange}
          onDismiss={() => setShowDsModal(false)}
          metrics
        />
      )}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title={t('query-editor-next.bulk-actions.delete-confirm-title', '', {
          count: selectedQueryRefIds.length,
          defaultValue_one: 'Delete {{count}} item?',
          defaultValue_other: 'Delete {{count}} items?',
        })}
        body={undefined}
        description={
          <DeleteConfirmDescription items={selectedQueries.map(({ refId }) => ({ id: refId, label: refId }))} />
        }
        confirmText={t('query-editor-next.bulk-actions.delete', 'Delete')}
        onConfirm={handleConfirmedDelete}
        onDismiss={() => setShowDeleteConfirm(false)}
      />
    </>
  );

  return { key: 'queries', actions, modals };
}

export function useBulkTransformationActions(): BulkActionGroup {
  const { selectedTransformationIds, setMultiSelectMode } = useQueryEditorUIContext();
  const { bulkDeleteTransformations, bulkToggleTransformationsDisabled } = useActionsContext();
  const { transformations } = usePanelContext();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const selectedIdSet = new Set(selectedTransformationIds);
  const selectedTransformations = transformations.filter(({ transformId }) => selectedIdSet.has(transformId));
  const allDisabled =
    selectedTransformations.length > 0 &&
    selectedTransformations.every(({ transformConfig }) => transformConfig.disabled);

  const handleConfirmedDelete = () => {
    bulkDeleteTransformations(selectedTransformationIds);
    setShowDeleteConfirm(false);
    setMultiSelectMode(false);
  };

  const actions: BulkAction[] = [
    {
      key: 'delete',
      icon: 'trash-alt',
      destructive: true,
      label: t('query-editor-next.bulk-actions.delete', 'Delete'),
      tooltip: t('query-editor-next.bulk-actions.delete-tooltip', 'Delete selected'),
      onClick: () => setShowDeleteConfirm(true),
    },
    {
      key: 'toggle-disabled',
      icon: allDisabled ? 'eye-slash' : 'eye',
      label: allDisabled
        ? t('query-editor-next.bulk-actions.enable', 'Enable')
        : t('query-editor-next.bulk-actions.disable', 'Disable'),
      tooltip: allDisabled
        ? t('query-editor-next.bulk-actions.enable-all-tooltip', 'Enable selected')
        : t('query-editor-next.bulk-actions.disable-all-tooltip', 'Disable selected'),
      onClick: () => bulkToggleTransformationsDisabled(selectedTransformationIds, !allDisabled),
    },
  ];

  const modals = (
    <ConfirmModal
      isOpen={showDeleteConfirm}
      title={t('query-editor-next.bulk-actions.delete-transformations-confirm-title', '', {
        count: selectedTransformationIds.length,
        defaultValue_one: 'Delete {{count}} transformation?',
        defaultValue_other: 'Delete {{count}} transformations?',
      })}
      body={undefined}
      description={
        <DeleteConfirmDescription
          items={selectedTransformations.map((transformation) => ({
            id: transformation.transformId,
            label: transformation.registryItem?.name || transformation.transformConfig.id,
          }))}
        />
      }
      confirmText={t('query-editor-next.bulk-actions.delete', 'Delete')}
      onConfirm={handleConfirmedDelete}
      onDismiss={() => setShowDeleteConfirm(false)}
    />
  );

  return { key: 'transformations', actions, modals };
}

const getStyles = (theme: GrafanaTheme2) => ({
  itemList: css({
    margin: 0,
    paddingLeft: theme.spacing(2.5),
    maxHeight: 200,
    overflowY: 'auto',
  }),
});
