import { css, cx } from '@emotion/css';
import { autoUpdate, offset, useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { useState } from 'react';

import { type GrafanaTheme2, rangeUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';
import { Button, floatingUtils, Icon, IconButton, Portal, Stack, Switch, useStyles2 } from '@grafana/ui';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';

import { type NotebookCellTimeRangeSpec } from '../../../types';
import { type NotebookCellItem } from '../NotebookCellItem';
import { buildCellTimeRangeSpec, buildDraftTimeRangeHost } from '../cellTimeRange';

interface Props {
  cell: NotebookCellItem;
  /** 'button': edit-mode icon, next to "Add query"/"Run query". 'label': read-only "Locked: …"
   * trigger, shown only once a cell actually has its own time range. */
  variant: 'button' | 'label';
}

/** Opens a popover to set or clear a cell's own time range, from either trigger (see `variant`). */
export function NotebookCellTimeRangeControl({ cell, variant }: Props) {
  const styles = useStyles2(getStyles);
  const { $timeRange } = cell.useState();
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-end',
    strategy: 'fixed',
    middleware: [offset(4), ...floatingUtils.getPositioningMiddleware('bottom-end')],
    // Keeps the popover attached to its anchor on scroll (see Toggletip for the same fix).
    whileElementsMounted: autoUpdate,
  });

  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  if (variant === 'label' && !$timeRange) {
    return null;
  }

  return (
    <>
      {variant === 'button' ? (
        <IconButton
          name="clock-nine"
          size="sm"
          variant={$timeRange ? 'primary' : 'secondary'}
          tooltip={
            $timeRange
              ? t('notebook.cell.time-range.tooltip-override', 'Has its own time range')
              : t('notebook.cell.time-range.tooltip-default', "Uses the notebook's time range")
          }
          aria-label={t('notebook.cell.time-range.button', 'Update time range')}
          onClick={() => setOpen(!open)}
          ref={refs.setReference}
        />
      ) : (
        <button type="button" className={styles.lockedLabel} onClick={() => setOpen(!open)} ref={refs.setReference}>
          <Icon name="lock" size="xs" />
          {t('notebook.cell.time-range.locked', 'Locked: {{from}} → {{to}}', {
            from: $timeRange!.state.from,
            to: $timeRange!.state.to,
          })}
        </button>
      )}
      {open && (
        <Portal>
          <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()} className={styles.popover}>
            <NotebookCellTimeRangePopoverContent cell={cell} onClose={() => setOpen(false)} />
          </div>
        </Portal>
      )}
    </>
  );
}

// Mounted fresh every time the popover opens, so the draft always starts from the cell's actual
// committed value and any unapplied edit is discarded for free when the popover closes.
function NotebookCellTimeRangePopoverContent({ cell, onClose }: { cell: NotebookCellItem; onClose: () => void }) {
  const styles = useStyles2(getStyles);
  const committed = cell.state.$timeRange ? buildCellTimeRangeSpec(cell.state.$timeRange) : seedFromAncestor(cell);

  const [host] = useState(() => buildDraftTimeRangeHost(committed));
  const [useNotebookTime, setUseNotebookTime] = useState(cell.state.$timeRange === undefined);

  const handleReset = () => {
    // Not a plain .setState({from, to}) — only SceneTimeRange's own onTimeRangeChange recomputes the
    // evaluated `.value` that TimeRangePicker actually renders.
    const range = rangeUtil.convertRawToRange({ from: committed.from, to: committed.to }, committed.timezone);
    host.state.$timeRange.onTimeRangeChange(range);
    setUseNotebookTime(cell.state.$timeRange === undefined);
  };

  const handleApply = () => {
    cell.onTimeRangeChange(useNotebookTime ? undefined : buildCellTimeRangeSpec(host.state.$timeRange));
    // A SceneQueryRunner only resolves its ancestor time range at activation, so changing which
    // object that is doesn't get noticed on its own — runQueries() forces it to re-resolve, same as
    // the dashboard's PanelTimeRangeDrawer.onApply does for the same transition.
    getQueryRunnerFor(cell.state.body)?.runQueries();
    onClose();
  };

  const handleToggle = (checked: boolean) => {
    setUseNotebookTime(checked);
    if (checked) {
      // Preview only — cell.state.$timeRange stays untouched until Apply.
      const ancestor = seedFromAncestor(cell);
      const range = rangeUtil.convertRawToRange({ from: ancestor.from, to: ancestor.to }, ancestor.timezone);
      host.state.$timeRange.onTimeRangeChange(range);
    }
  };

  return (
    <Stack direction="column" gap={1}>
      <div className={styles.switchRow}>
        <span>{t('notebook.cell.time-range.use-notebook-time', 'Use notebook time range')}</span>
        <Switch value={useNotebookTime} onChange={(e) => handleToggle(e.currentTarget.checked)} />
      </div>
      <div className={cx(styles.picker, useNotebookTime && styles.pickerDisabled)} aria-disabled={useNotebookTime}>
        <host.state.timePicker.Component model={host.state.timePicker} />
      </div>
      <Stack justifyContent="flex-end">
        <Button size="sm" variant="secondary" onClick={handleReset}>
          {t('notebook.cell.time-range.reset', 'Reset')}
        </Button>
        <Button size="sm" variant="primary" onClick={handleApply}>
          {t('common.apply', 'Apply')}
        </Button>
      </Stack>
    </Stack>
  );
}

// The range this cell would use with no override of its own. Starts from the cell's *parent*, since
// sceneGraph.getTimeRange checks the object it's given first — starting at the cell would just
// return its own still-set `$timeRange` instead of skipping to the notebook's ambient range.
function seedFromAncestor(cell: NotebookCellItem): NotebookCellTimeRangeSpec {
  const { from, to, timeZone } = sceneGraph.getTimeRange(cell.parent ?? cell).state;
  return { from, to, timezone: timeZone };
}

const getStyles = (theme: GrafanaTheme2) => ({
  popover: css({
    zIndex: theme.zIndex.dropdown,
    backgroundColor: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    padding: theme.spacing(1.5),
    minWidth: 320,
  }),
  switchRow: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.background.secondary,
  }),
  picker: css({
    width: '100%',
  }),
  pickerDisabled: css({
    opacity: 0.5,
    pointerEvents: 'none',
  }),
  lockedLabel: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.shape.radius.pill,
    backgroundColor: theme.colors.background.secondary,
    border: 'none',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    cursor: 'pointer',
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
});
