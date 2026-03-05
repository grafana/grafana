import { css } from '@emotion/css';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { isExpressionReference } from '@grafana/runtime';
import { useState } from 'react';

import { Button, ConfirmModal, Stack, Text, useStyles2 } from '@grafana/ui';
import { DataSourceModal } from 'app/features/datasources/components/picker/DataSourceModal';

import { useActionsContext, usePanelContext, useQueryEditorUIContext, useQueryRunnerContext } from '../QueryEditorContext';

export function BulkActionsBar() {
  const styles = useStyles2(getStyles);

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
  const selectedQueries = queries.filter((q) => selectedQueryRefIds.includes(q.refId));
  const allSelectedQueriesHidden = selectedQueries.length > 0 && selectedQueries.every((q) => q.hide);

  // Determine disabled/enabled state for selected transformations
  const selectedTransformations = transformations.filter((transformation) =>
    selectedTransformationIds.includes(transformation.transformId)
  );
  const allSelectedTransformationsDisabled =
    selectedTransformations.length > 0 &&
    selectedTransformations.every((transformation) => transformation.transformConfig.disabled);

  // Only show datasource change if all selected queries are non-expression queries
  const canChangeDatasource =
    hasQueriesSelected && selectedQueries.every((q) => !isExpressionReference(q.datasource));

  const handleConfirmedDeleteQueries = () => {
    bulkDeleteQueries([...selectedQueryRefIds]);
    setShowDeleteQueriesConfirm(false);
    clearSelection();
  };

  const handleBulkToggleHide = () => {
    bulkToggleQueriesHide([...selectedQueryRefIds], !allSelectedQueriesHidden);
  };

  const handleConfirmedDeleteTransformations = () => {
    bulkDeleteTransformations([...selectedTransformationIds]);
    setShowDeleteTransformationsConfirm(false);
    clearSelection();
  };

  const handleBulkToggleDisabled = () => {
    bulkToggleTransformationsDisabled([...selectedTransformationIds], !allSelectedTransformationsDisabled);
  };

  const handleDatasourceChange = (settings: DataSourceInstanceSettings) => {
    bulkChangeDataSource([...selectedQueryRefIds], settings);
    setShowDsModal(false);
  };

  return (
    <>
      <div
        className={styles.bar}
        role="toolbar"
        aria-label={t('query-editor-next.bulk-actions.toolbar-label', 'Bulk actions')}
      >
        {/* Queries section */}
        {hasQueriesSelected && (
          <>
            <Text variant="bodySmall" color="secondary" truncate>
              {t('query-editor-next.bulk-actions.queries-selected', '{{count}} queries selected', {
                count: selectedQueryRefIds.length,
              })}
            </Text>
            <div className={styles.separator} aria-hidden="true" />
            <Stack direction="row" gap={0.25}>
              <Button
                size="sm"
                variant="destructive"
                fill="text"
                icon="trash-alt"
                onClick={() => setShowDeleteQueriesConfirm(true)}
                tooltip={t('query-editor-next.bulk-actions.delete-queries', 'Delete selected queries')}
              >
                {t('query-editor-next.bulk-actions.delete', 'Delete')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                fill="text"
                icon={allSelectedQueriesHidden ? 'eye' : 'eye-slash'}
                onClick={handleBulkToggleHide}
                tooltip={
                  allSelectedQueriesHidden
                    ? t('query-editor-next.bulk-actions.show-all-queries', 'Show all selected queries')
                    : t('query-editor-next.bulk-actions.hide-all-queries', 'Hide all selected queries')
                }
              >
                {allSelectedQueriesHidden
                  ? t('query-editor-next.bulk-actions.show-all', 'Show all')
                  : t('query-editor-next.bulk-actions.hide-all', 'Hide all')}
              </Button>
              {canChangeDatasource && (
                <Button
                  size="sm"
                  variant="secondary"
                  fill="text"
                  icon="database-alt"
                  onClick={() => setShowDsModal(true)}
                  tooltip={t(
                    'query-editor-next.bulk-actions.change-datasource',
                    'Change data source for selected queries'
                  )}
                >
                  {t('query-editor-next.bulk-actions.datasource', 'Data source')}
                </Button>
              )}
            </Stack>
          </>
        )}

        {/* Transformations section */}
        {hasTransformationsSelected && (
          <>
            {hasQueriesSelected && <div className={styles.separator} aria-hidden="true" />}
            <Text variant="bodySmall" color="secondary" truncate>
              {t('query-editor-next.bulk-actions.transformations-selected', '{{count}} transformations selected', {
                count: selectedTransformationIds.length,
              })}
            </Text>
            <div className={styles.separator} aria-hidden="true" />
            <Stack direction="row" gap={0.25}>
              <Button
                size="sm"
                variant="destructive"
                fill="text"
                icon="trash-alt"
                onClick={() => setShowDeleteTransformationsConfirm(true)}
                tooltip={t(
                  'query-editor-next.bulk-actions.delete-transformations',
                  'Delete selected transformations'
                )}
              >
                {t('query-editor-next.bulk-actions.delete', 'Delete')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                fill="text"
                icon={allSelectedTransformationsDisabled ? 'play' : 'pause'}
                onClick={handleBulkToggleDisabled}
                tooltip={
                  allSelectedTransformationsDisabled
                    ? t(
                        'query-editor-next.bulk-actions.enable-all-transformations',
                        'Enable all selected transformations'
                      )
                    : t(
                        'query-editor-next.bulk-actions.disable-all-transformations',
                        'Disable all selected transformations'
                      )
                }
              >
                {allSelectedTransformationsDisabled
                  ? t('query-editor-next.bulk-actions.enable-all', 'Enable all')
                  : t('query-editor-next.bulk-actions.disable-all', 'Disable all')}
              </Button>
            </Stack>
          </>
        )}

        {/* Clear selection */}
        <div className={styles.separator} aria-hidden="true" />
        <Button
          size="sm"
          variant="secondary"
          fill="text"
          icon="times"
          onClick={clearSelection}
          tooltip={t('query-editor-next.bulk-actions.clear-selection', 'Clear selection')}
          aria-label={t('query-editor-next.bulk-actions.clear-selection', 'Clear selection')}
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
      {showDeleteQueriesConfirm && (
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
      )}

      {/* Delete transformations confirmation */}
      {showDeleteTransformationsConfirm && (
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
      )}
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
      background: theme.colors.background.secondary,
      borderBottom: `1px solid ${theme.colors.border.medium}`,
      flexWrap: 'wrap',
    }),
    separator: css({
      width: 1,
      height: theme.spacing(2),
      background: theme.colors.border.medium,
      flexShrink: 0,
    }),
  };
}
