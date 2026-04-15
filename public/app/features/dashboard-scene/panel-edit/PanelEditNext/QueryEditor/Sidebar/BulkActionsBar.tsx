import { css } from '@emotion/css';
import { type ReactNode, useState } from 'react';

import { type DataSourceInstanceSettings, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { isExpressionReference } from '@grafana/runtime';
import { Button, ConfirmModal, type IconName, Stack, useStyles2 } from '@grafana/ui';
import { DataSourceModal } from 'app/features/datasources/components/picker/DataSourceModal';

import {
  useActionsContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from '../QueryEditorContext';

interface BulkActionButtonsProps {
  onDelete: () => void;
  toggleIcon: IconName;
  toggleTooltip: string;
  onToggle: () => void;
  children?: ReactNode;
}

function BulkActionButtons({ onDelete, toggleIcon, toggleTooltip, onToggle, children }: BulkActionButtonsProps) {
  return (
    <Stack direction="row" gap={0.5}>
      <Button
        size="sm"
        variant="destructive"
        fill="text"
        icon="trash-alt"
        onClick={onDelete}
        tooltip={t('query-editor-next.bulk-actions.delete-tooltip', 'Delete selected')}
        aria-label={t('query-editor-next.bulk-actions.delete-tooltip', 'Delete selected')}
      />
      <Button
        icon={toggleIcon}
        size="sm"
        variant="secondary"
        fill="text"
        onClick={onToggle}
        tooltip={toggleTooltip}
        aria-label={toggleTooltip}
      />
      {children}
    </Stack>
  );
}

function BulkQueryActions() {
  const { selectedQueryRefIds, clearSelection, isStackedView, setIsStackedView } = useQueryEditorUIContext();
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
    clearSelection();
  };

  const handleDatasourceChange = async (settings: DataSourceInstanceSettings) => {
    await bulkChangeDataSource(selectedQueryRefIds, settings);
    setShowDsModal(false);
    clearSelection();
  };

  return (
    <>
      <BulkActionButtons
        onDelete={() => setShowDeleteConfirm(true)}
        toggleIcon={allHidden ? 'eye-slash' : 'eye'}
        toggleTooltip={
          allHidden
            ? t('query-editor-next.bulk-actions.show-all-tooltip', 'Show all selected')
            : t('query-editor-next.bulk-actions.hide-all-tooltip', 'Hide all selected')
        }
        onToggle={() => bulkToggleQueriesHide(selectedQueryRefIds, !allHidden)}
      >
        {canChangeDatasource && (
          <Button
            size="sm"
            variant="secondary"
            fill="text"
            icon="database"
            onClick={() => setShowDsModal(true)}
            tooltip={t('query-editor-next.bulk-actions.change-datasource', 'Change data source for selected queries')}
            aria-label={t(
              'query-editor-next.bulk-actions.change-datasource',
              'Change data source for selected queries'
            )}
          />
        )}
        <Button
          icon="layers-alt"
          size="sm"
          variant="secondary"
          fill={isStackedView ? 'solid' : 'text'}
          aria-pressed={isStackedView}
          onClick={() => setIsStackedView(!isStackedView)}
          tooltip={t('query-editor-next.bulk-actions.stacked-view-tooltip', 'View selected queries in a stacked list')}
          aria-label={t(
            'query-editor-next.bulk-actions.stacked-view-tooltip',
            'View selected queries in a stacked list'
          )}
        />
      </BulkActionButtons>

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
        title={t('query-editor-next.bulk-actions.delete-confirm-title', 'Delete {{count}} items?', {
          count: selectedQueryRefIds.length,
        })}
        body={undefined}
        description={t('query-editor-next.bulk-actions.delete-confirm-body', 'This action cannot be undone.')}
        confirmText={t('query-editor-next.bulk-actions.delete', 'Delete')}
        onConfirm={handleConfirmedDelete}
        onDismiss={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}

function BulkTransformationActions() {
  const { selectedTransformationIds, clearSelection, isStackedView, setIsStackedView } = useQueryEditorUIContext();
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
    clearSelection();
  };

  return (
    <>
      <BulkActionButtons
        onDelete={() => setShowDeleteConfirm(true)}
        toggleIcon={allDisabled ? 'eye-slash' : 'eye'}
        toggleTooltip={
          allDisabled
            ? t('query-editor-next.bulk-actions.enable-all-tooltip', 'Enable all selected')
            : t('query-editor-next.bulk-actions.disable-all-tooltip', 'Disable all selected')
        }
        onToggle={() => bulkToggleTransformationsDisabled(selectedTransformationIds, !allDisabled)}
      >
        <Button
          icon="layers-alt"
          size="sm"
          variant="secondary"
          fill={isStackedView ? 'solid' : 'text'}
          aria-pressed={isStackedView}
          onClick={() => setIsStackedView(!isStackedView)}
          tooltip={t(
            'query-editor-next.bulk-actions.stacked-view-transformations-tooltip',
            'View selected transformations in a stacked list'
          )}
          aria-label={t(
            'query-editor-next.bulk-actions.stacked-view-transformations-tooltip',
            'View selected transformations in a stacked list'
          )}
        />
      </BulkActionButtons>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title={t(
          'query-editor-next.bulk-actions.delete-transformations-confirm-title',
          'Delete {{count}} transformations?',
          { count: selectedTransformationIds.length }
        )}
        body={undefined}
        description={t('query-editor-next.bulk-actions.delete-confirm-body', 'This action cannot be undone.')}
        confirmText={t('query-editor-next.bulk-actions.delete', 'Delete')}
        onConfirm={handleConfirmedDelete}
        onDismiss={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}

export function BulkActionsBar() {
  const styles = useStyles2(getStyles);
  const { selectedQueryRefIds, selectedTransformationIds, clearSelection } = useQueryEditorUIContext();

  const hasMultipleQueriesSelected = selectedQueryRefIds.length >= 2;
  const hasMultipleTransformationsSelected = selectedTransformationIds.length >= 2;

  if (!hasMultipleQueriesSelected && !hasMultipleTransformationsSelected) {
    return null;
  }

  return (
    <div
      className={styles.bar}
      role="toolbar"
      aria-label={t('query-editor-next.bulk-actions.toolbar-label', 'Bulk actions')}
    >
      {hasMultipleQueriesSelected && <BulkQueryActions />}
      {hasMultipleTransformationsSelected && <BulkTransformationActions />}
      <Button
        size="sm"
        variant="secondary"
        fill="text"
        icon="times"
        onClick={clearSelection}
        tooltip={t('query-editor-next.bulk-actions.clear-selection', 'Clear selection')}
        aria-label={t('query-editor-next.bulk-actions.clear-selection', 'Clear selection')}
        className={styles.clearButton}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  bar: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.75, 1.5),
    background: theme.colors.background.canvas,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    minHeight: theme.spacing(5),
  }),
  clearButton: css({
    marginLeft: 'auto',
  }),
});
