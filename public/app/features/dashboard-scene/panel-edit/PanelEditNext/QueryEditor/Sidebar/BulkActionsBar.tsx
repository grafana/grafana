import { css } from '@emotion/css';
import { useState } from 'react';
import { useMeasure } from 'react-use';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { isExpressionReference } from '@grafana/runtime';
import { Button, ConfirmModal, IconName, Stack, useStyles2 } from '@grafana/ui';
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
  toggleLabel: string;
  toggleTooltip: string;
  onToggle: () => void;
  compact?: boolean;
  children?: React.ReactNode;
}

function BulkActionButtons({
  onDelete,
  toggleIcon,
  toggleLabel,
  toggleTooltip,
  onToggle,
  compact,
  children,
}: BulkActionButtonsProps) {
  return (
    <Stack direction="row" gap={0.25}>
      <Button
        size="sm"
        variant="destructive"
        fill="text"
        icon="trash-alt"
        onClick={onDelete}
        tooltip={t('query-editor-next.bulk-actions.delete-tooltip', 'Delete selected')}
      >
        {compact ? undefined : t('query-editor-next.bulk-actions.delete', 'Delete')}
      </Button>
      <Button size="sm" variant="secondary" fill="text" icon={toggleIcon} onClick={onToggle} tooltip={toggleTooltip}>
        {compact ? undefined : toggleLabel}
      </Button>
      {children}
    </Stack>
  );
}

export function BulkActionsBar() {
  const styles = useStyles2(getStyles);
  const [barRef, { width: barWidth }] = useMeasure<HTMLDivElement>();

  const { selectedQueryRefIds, selectedTransformationIds, clearSelection } = useQueryEditorUIContext();
  const {
    bulkDeleteQueries,
    bulkToggleQueriesHide,
    bulkDeleteTransformations,
    bulkToggleTransformationsDisabled,
    bulkChangeDataSource,
  } = useActionsContext();
  const { queries } = useQueryRunnerContext();
  const { transformations } = usePanelContext();

  const [showDsModal, setShowDsModal] = useState(false);
  const [showDeleteQueriesConfirm, setShowDeleteQueriesConfirm] = useState(false);
  const [showDeleteTransformationsConfirm, setShowDeleteTransformationsConfirm] = useState(false);

  const hasQueriesSelected = selectedQueryRefIds.length >= 2;
  const hasTransformationsSelected = selectedTransformationIds.length >= 2;

  // Only show when 2+ items of the same type are selected
  if (!hasQueriesSelected && !hasTransformationsSelected) {
    return null;
  }

  // Determine hide/show state for selected queries
  const selectedQueries = hasQueriesSelected ? queries.filter((q) => selectedQueryRefIds.includes(q.refId)) : [];
  const allSelectedQueriesHidden = selectedQueries.length > 0 && selectedQueries.every((q) => q.hide);

  // Determine disabled/enabled state for selected transformations
  const selectedTransformations = hasTransformationsSelected
    ? transformations.filter((transformation) => selectedTransformationIds.includes(transformation.transformId))
    : [];

  const allSelectedTransformationsDisabled =
    selectedTransformations.length > 0 &&
    selectedTransformations.every((transformation) => transformation.transformConfig.disabled);

  // Only show datasource change if all selected queries are non-expression queries
  const canChangeDatasource = hasQueriesSelected && selectedQueries.every((q) => !isExpressionReference(q.datasource));

  const compact = canChangeDatasource && barWidth > 0 && barWidth < 280;

  const handleConfirmedDeleteQueries = () => {
    bulkDeleteQueries(selectedQueryRefIds);
    setShowDeleteQueriesConfirm(false);
    // Note: the bulkDeleteQueries action wrapper also calls clearSelection internally,
    // but we call it here explicitly so test mocks (which replace the real action) still
    // trigger the bar to dismiss.
    clearSelection();
  };

  const handleBulkToggleHide = () => {
    bulkToggleQueriesHide(selectedQueryRefIds, !allSelectedQueriesHidden);
  };

  const handleConfirmedDeleteTransformations = () => {
    bulkDeleteTransformations(selectedTransformationIds);
    setShowDeleteTransformationsConfirm(false);
    // Same rationale as handleConfirmedDeleteQueries above.
    clearSelection();
  };

  const handleBulkToggleDisabled = () => {
    bulkToggleTransformationsDisabled(selectedTransformationIds, !allSelectedTransformationsDisabled);
  };

  const handleDatasourceChange = (settings: DataSourceInstanceSettings) => {
    bulkChangeDataSource(selectedQueryRefIds, settings);
    setShowDsModal(false);
  };

  return (
    <>
      <div
        ref={barRef}
        className={styles.bar}
        role="toolbar"
        aria-label={t('query-editor-next.bulk-actions.toolbar-label', 'Bulk actions')}
      >
        {/* Queries section */}
        {hasQueriesSelected && (
          <BulkActionButtons
            onDelete={() => setShowDeleteQueriesConfirm(true)}
            toggleIcon={allSelectedQueriesHidden ? 'eye-slash' : 'eye'}
            toggleLabel={
              allSelectedQueriesHidden
                ? t('query-editor-next.bulk-actions.show', 'Show')
                : t('query-editor-next.bulk-actions.hide', 'Hide')
            }
            toggleTooltip={
              allSelectedQueriesHidden
                ? t('query-editor-next.bulk-actions.show-all-tooltip', 'Show all selected')
                : t('query-editor-next.bulk-actions.hide-all-tooltip', 'Hide all selected')
            }
            onToggle={handleBulkToggleHide}
            compact={compact}
          >
            {canChangeDatasource && (
              <Button
                size="sm"
                variant="secondary"
                fill="text"
                icon="database"
                onClick={() => setShowDsModal(true)}
                tooltip={t(
                  'query-editor-next.bulk-actions.change-datasource',
                  'Change data source for selected queries'
                )}
              >
                {compact ? undefined : t('query-editor-next.bulk-actions.datasource', 'Data source')}
              </Button>
            )}
          </BulkActionButtons>
        )}

        {/* Transformations section */}
        {hasTransformationsSelected && (
          <BulkActionButtons
            onDelete={() => setShowDeleteTransformationsConfirm(true)}
            toggleIcon={allSelectedTransformationsDisabled ? 'eye-slash' : 'eye'}
            toggleLabel={
              allSelectedTransformationsDisabled
                ? t('query-editor-next.bulk-actions.enable-all', 'Enable all')
                : t('query-editor-next.bulk-actions.disable-all', 'Disable all')
            }
            toggleTooltip={
              allSelectedTransformationsDisabled
                ? t('query-editor-next.bulk-actions.enable-all-tooltip', 'Enable all selected')
                : t('query-editor-next.bulk-actions.disable-all-tooltip', 'Disable all selected')
            }
            onToggle={handleBulkToggleDisabled}
            compact={compact}
          />
        )}

        {/* Clear selection */}
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

      {/* Datasource change modal */}
      {showDsModal && (
        <DataSourceModal
          current={null}
          onChange={handleDatasourceChange}
          onDismiss={() => setShowDsModal(false)}
          metrics
        />
      )}

      {/* Delete queries confirmation */}
      <ConfirmModal
        isOpen={showDeleteQueriesConfirm}
        title={t('query-editor-next.bulk-actions.delete-queries-confirm-title', 'Delete {{count}} queries?', {
          count: selectedQueryRefIds.length,
        })}
        body={null}
        description={t('query-editor-next.bulk-actions.delete-confirm-body', 'This action cannot be undone.')}
        confirmText={t('query-editor-next.bulk-actions.delete', 'Delete')}
        onConfirm={handleConfirmedDeleteQueries}
        onDismiss={() => setShowDeleteQueriesConfirm(false)}
      />

      {/* Delete transformations confirmation */}
      <ConfirmModal
        isOpen={showDeleteTransformationsConfirm}
        title={t(
          'query-editor-next.bulk-actions.delete-transformations-confirm-title',
          'Delete {{count}} transformations?',
          { count: selectedTransformationIds.length }
        )}
        body={null}
        description={t('query-editor-next.bulk-actions.delete-confirm-body', 'This action cannot be undone.')}
        confirmText={t('query-editor-next.bulk-actions.delete', 'Delete')}
        onConfirm={handleConfirmedDeleteTransformations}
        onDismiss={() => setShowDeleteTransformationsConfirm(false)}
      />
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    bar: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.75, 1),
      background: theme.colors.background.canvas,
      borderTop: `1px solid ${theme.colors.border.medium}`,
      borderBottom: `1px solid ${theme.colors.border.medium}`,
    }),
    clearButton: css({
      marginLeft: 'auto',
    }),
  };
}
