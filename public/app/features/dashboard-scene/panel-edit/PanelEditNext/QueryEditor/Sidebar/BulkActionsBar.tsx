import { css, cx } from '@emotion/css';
import { type ReactNode, useState } from 'react';
import { useMeasure } from 'react-use';

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
  toggleLabel: string;
  toggleTooltip: string;
  onToggle: () => void;
  compact?: boolean;
  children?: ReactNode;
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
    <Stack direction="row" gap={0.5}>
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

interface BulkQueryActionsProps {
  barWidth: number;
}

function BulkQueryActions({ barWidth }: BulkQueryActionsProps) {
  const { selectedQueryRefIds, clearSelection } = useQueryEditorUIContext();
  const { bulkDeleteQueries, bulkToggleQueriesHide, bulkChangeDataSource } = useActionsContext();
  const { queries } = useQueryRunnerContext();

  const [showDsModal, setShowDsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const selectedRefIdSet = new Set(selectedQueryRefIds);
  const selectedQueries = queries.filter(({ refId }) => selectedRefIdSet.has(refId));
  const allHidden = selectedQueries.length > 0 && selectedQueries.every(({ hide }) => hide);
  const canChangeDatasource = selectedQueries.every(({ datasource }) => !isExpressionReference(datasource));
  const compact = barWidth > 0 && barWidth < 280;

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
        toggleLabel={
          allHidden
            ? t('query-editor-next.bulk-actions.show', 'Show')
            : t('query-editor-next.bulk-actions.hide', 'Hide')
        }
        toggleTooltip={
          allHidden
            ? t('query-editor-next.bulk-actions.show-all-tooltip', 'Show all selected')
            : t('query-editor-next.bulk-actions.hide-all-tooltip', 'Hide all selected')
        }
        onToggle={() => bulkToggleQueriesHide(selectedQueryRefIds, !allHidden)}
        compact={compact}
      >
        {canChangeDatasource && (
          <Button
            size="sm"
            variant="secondary"
            fill="text"
            icon="database"
            onClick={() => setShowDsModal(true)}
            tooltip={t('query-editor-next.bulk-actions.change-datasource', 'Change data source for selected queries')}
          >
            {compact ? undefined : t('query-editor-next.bulk-actions.datasource', 'Data source')}
          </Button>
        )}
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

interface BulkTransformationActionsProps {
  barWidth: number;
}

function BulkTransformationActions({ barWidth }: BulkTransformationActionsProps) {
  const { selectedTransformationIds, clearSelection } = useQueryEditorUIContext();
  const { bulkDeleteTransformations, bulkToggleTransformationsDisabled } = useActionsContext();
  const { transformations } = usePanelContext();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const selectedIdSet = new Set(selectedTransformationIds);
  const selectedTransformations = transformations.filter(({ transformId }) => selectedIdSet.has(transformId));
  const allDisabled =
    selectedTransformations.length > 0 &&
    selectedTransformations.every(({ transformConfig }) => transformConfig.disabled);
  const compact = barWidth > 0 && barWidth < 280;

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
        compact={compact}
        toggleLabel={
          allDisabled
            ? t('query-editor-next.bulk-actions.enable-all', 'Enable all')
            : t('query-editor-next.bulk-actions.disable-all', 'Disable all')
        }
        toggleTooltip={
          allDisabled
            ? t('query-editor-next.bulk-actions.enable-all-tooltip', 'Enable all selected')
            : t('query-editor-next.bulk-actions.disable-all-tooltip', 'Disable all selected')
        }
        onToggle={() => bulkToggleTransformationsDisabled(selectedTransformationIds, !allDisabled)}
      />

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

interface BulkActionsBarProps {
  /** Optional class for layout/animation overrides applied by the consumer. */
  className?: string;
}

interface BulkActionsVisibilityOptions {
  selectedQueryCount: number;
  selectedTransformationCount: number;
  multiSelectMode: boolean;
}

interface BulkActionsVisibility {
  hasQueryActions: boolean;
  hasTransformationActions: boolean;
  shouldRender: boolean;
}

// In explicit multi-select mode any selection is actionable. Outside of it
// (keyboard-shortcut path: Cmd/Ctrl+click, Shift+click) the bar opens at 2+
// to avoid noise on every plain single-card click.
function hasActionableSelection(selectionCount: number, multiSelectMode: boolean): boolean {
  return multiSelectMode ? selectionCount >= 1 : selectionCount >= 2;
}

function getBulkActionsVisibility({
  selectedQueryCount,
  selectedTransformationCount,
  multiSelectMode,
}: BulkActionsVisibilityOptions): BulkActionsVisibility {
  const hasQueryActions = hasActionableSelection(selectedQueryCount, multiSelectMode);
  const hasTransformationActions = hasActionableSelection(selectedTransformationCount, multiSelectMode);

  return {
    hasQueryActions,
    hasTransformationActions,
    // Stay visible while the user is in multi-select mode so they always have
    // an affordance to exit (the close button) — even if they've toggled off
    // every selection via Cmd+click.
    shouldRender: multiSelectMode || hasQueryActions || hasTransformationActions,
  };
}

export function BulkActionsBar({ className }: BulkActionsBarProps = {}) {
  const styles = useStyles2(getStyles);
  const [barRef, { width: barWidth }] = useMeasure<HTMLDivElement>();
  const { selectedQueryRefIds, selectedTransformationIds, clearSelection, multiSelectMode, setMultiSelectMode } =
    useQueryEditorUIContext();

  const { hasQueryActions, hasTransformationActions, shouldRender } = getBulkActionsVisibility({
    selectedQueryCount: selectedQueryRefIds.length,
    selectedTransformationCount: selectedTransformationIds.length,
    multiSelectMode,
  });

  if (!shouldRender) {
    return null;
  }

  const hasAnySelection = selectedQueryRefIds.length > 0 || selectedTransformationIds.length > 0;

  // When multi-select mode is active, closing the bar should also leave the
  // mode so the sidebar returns to its default (single-selection) presentation.
  const handleClear = () => {
    if (hasAnySelection) {
      clearSelection();
    }
    if (multiSelectMode) {
      setMultiSelectMode(false);
    }
  };

  return (
    <div
      ref={barRef}
      className={cx(styles.bar, className)}
      role="toolbar"
      aria-label={t('query-editor-next.bulk-actions.toolbar-label', 'Bulk actions')}
    >
      {hasQueryActions && <BulkQueryActions barWidth={barWidth} />}
      {hasTransformationActions && <BulkTransformationActions barWidth={barWidth} />}
      <Button
        size="sm"
        variant="secondary"
        fill="text"
        icon="times"
        onClick={handleClear}
        tooltip={t('query-editor-next.bulk-actions.clear-selection', 'Clear selection')}
        aria-label={t('query-editor-next.bulk-actions.clear-selection', 'Clear selection')}
        className={styles.clearButton}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // The bar lives at the bottom of the sidebar (inside SidebarFooter), so it
  // matches the footer background and rounds the bottom corners to follow the
  // sidebar's outline.
  bar: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.75, 1.5),
    background: theme.colors.background.primary,
    borderBottomLeftRadius: theme.shape.radius.default,
    borderBottomRightRadius: theme.shape.radius.default,
  }),
  clearButton: css({
    marginLeft: 'auto',
  }),
});
