import { css } from '@emotion/css';
import { Fragment } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import { trackMultiSelectToggle } from '../../tracking';
import { useQueryEditorUIContext } from '../QueryEditorContext';

import { type BulkActionGroup, useBulkQueryActions, useBulkTransformationActions } from './useBulkActions';
import { useCompactOnOverflow } from './useCompactOnOverflow';

interface BulkActionButtonsProps {
  groups: BulkActionGroup[];
  compact: boolean;
}

// Single renderer for every section's actions: all groups share one layout and one compact
// decision, so the bar behaves identically no matter which sections are selected.
function BulkActionButtons({ groups, compact }: BulkActionButtonsProps) {
  return (
    <Stack direction="row" gap={0.5}>
      {/* Per-render flatMap/closures are a non-issue: ≤2 groups and ≤5 buttons total, and no
          memoized children that would benefit from stable references. */}
      {groups.flatMap(({ key: groupKey, actions }) =>
        actions.map(({ key, icon, label, tooltip, destructive, onClick }) => (
          <Button
            key={`${groupKey}-${key}`}
            size="sm"
            variant={destructive ? 'destructive' : 'secondary'}
            fill="text"
            icon={icon}
            onClick={onClick}
            tooltip={tooltip}
            // Explicit label so the accessible name stays stable when the text is dropped in
            // compact mode (Button would otherwise fall back to the tooltip as its name).
            aria-label={label}
          >
            {compact ? undefined : label}
          </Button>
        ))
      )}
    </Stack>
  );
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

// Bulk actions are only available in explicit multi-select mode. Exported so the parent
// (SidebarFooter) can ternary-render the bar vs. counts off the same rule.
export function getBulkActionsVisibility({
  selectedQueryCount,
  selectedTransformationCount,
  multiSelectMode,
}: BulkActionsVisibilityOptions): BulkActionsVisibility {
  const hasQueryActions = multiSelectMode && selectedQueryCount > 0;
  const hasTransformationActions = multiSelectMode && selectedTransformationCount > 0;

  return {
    hasQueryActions,
    hasTransformationActions,
    shouldRender: hasQueryActions || hasTransformationActions,
  };
}

export function BulkActionsBar() {
  const styles = useStyles2(getStyles);
  const { selectedQueryRefIds, selectedTransformationIds, setMultiSelectMode, multiSelectMode } =
    useQueryEditorUIContext();

  const queryGroup = useBulkQueryActions();
  const transformationGroup = useBulkTransformationActions();

  const { hasQueryActions, hasTransformationActions, shouldRender } = getBulkActionsVisibility({
    selectedQueryCount: selectedQueryRefIds.length,
    selectedTransformationCount: selectedTransformationIds.length,
    multiSelectMode,
  });

  const groups: BulkActionGroup[] = [];

  if (hasQueryActions) {
    groups.push(queryGroup);
  }

  if (hasTransformationActions) {
    groups.push(transformationGroup);
  }

  // Labels and button sets change at runtime (Hide vs Show, the conditional Data source button,
  // sections joining/leaving the selection), so the key captures everything that affects width.
  const contentKey = groups
    .flatMap(({ key: groupKey, actions }) => actions.map(({ key, label }) => `${groupKey}:${key}:${label}`))
    .join('|');

  const { containerRef, contentRef, compact } = useCompactOnOverflow(contentKey);

  if (!shouldRender) {
    return null;
  }

  const handleClear = () => {
    trackMultiSelectToggle('exit');
    setMultiSelectMode(false);
  };

  return (
    <>
      <div
        className={styles.bar}
        role="toolbar"
        aria-label={t('query-editor-next.bulk-actions.toolbar-label', 'Bulk actions')}
      >
        <div ref={containerRef} className={styles.actions}>
          {/* Measured wrapper: as a flex item it cannot shrink below its content, so its own
              width is the true full width of the buttons whether they fit or overflow. */}
          <div ref={contentRef}>
            <BulkActionButtons groups={groups} compact={compact} />
          </div>
        </div>
        <Stack alignItems="center" shrink={0}>
          <Button
            size="sm"
            variant="secondary"
            fill="text"
            icon="times"
            onClick={handleClear}
            tooltip={t('query-editor-next.bulk-actions.clear-selection', 'Clear selection')}
            aria-label={t('query-editor-next.bulk-actions.clear-selection', 'Clear selection')}
          />
        </Stack>
      </div>
      {groups.map(({ key, modals }) => (
        <Fragment key={key}>{modals}</Fragment>
      ))}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  bar: css({
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  actions: css({
    flex: 1,
    minWidth: 0,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
    whiteSpace: 'nowrap',

    // Fade out clipped content for the extreme case where even icon-only buttons overflow.
    '&::after': {
      content: '""',
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: theme.spacing(4),
      background: `linear-gradient(to right, transparent, ${theme.colors.background.primary})`,
      pointerEvents: 'none',
    },
  }),
});
