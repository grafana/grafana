import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2, rangeUtil, type TimeOption } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';
import { Box, Button, IconButton, Stack, Switch, Toggletip, useStyles2 } from '@grafana/ui';

import { isNotebookScene } from '../../isNotebookScene';
import { type NotebookCellItem } from '../NotebookCellItem';
import { buildCellTimeRangeSpec, buildDraftTimeRangeHost, type CellTimeRangeSpec } from '../cellTimeRange';

interface Props {
  cell: NotebookCellItem;
}

export function NotebookCellTimeRangeControl({ cell }: Props) {
  const { $timeRange } = cell.useState();
  const [open, setOpen] = useState(false);

  return (
    <Toggletip
      show={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      closeButton={false}
      placement="bottom-end"
      fitContent
      content={<NotebookCellTimeRangePopoverContent cell={cell} onClose={() => setOpen(false)} />}
    >
      {$timeRange ? (
        <Button fill="solid" size="sm" icon="lock" variant="secondary">
          {t('notebook.cell.time-range.locked', 'Locked: {{range}}', {
            range: rangeUtil.describeTimeRange(
              { from: $timeRange.state.from, to: $timeRange.state.to },
              getAncestorTimeZone(cell),
              getQuickRanges(cell)
            ),
            interpolation: { escapeValue: false },
          })}
        </Button>
      ) : (
        <IconButton
          name="clock-nine"
          size="sm"
          variant="secondary"
          tooltip={t('notebook.cell.time-range.tooltip-default', "Uses the notebook's time range")}
          aria-label={t('notebook.cell.time-range.button', 'Update time range')}
        />
      )}
    </Toggletip>
  );
}

function NotebookCellTimeRangePopoverContent({ cell, onClose }: { cell: NotebookCellItem; onClose: () => void }) {
  const styles = useStyles2(getStyles);
  // Timezone always follows the notebook, never the cell — same convention as a dashboard panel's
  // own time override (PanelTimeRange), which never owns its timezone either.
  const ancestorTimeZone = getAncestorTimeZone(cell);
  const committed = cell.state.$timeRange ? buildCellTimeRangeSpec(cell.state.$timeRange) : seedFromAncestor(cell);

  const [host] = useState(() =>
    buildDraftTimeRangeHost(committed.from, committed.to, ancestorTimeZone, getQuickRanges(cell))
  );
  const [useNotebookTime, setUseNotebookTime] = useState(cell.state.$timeRange === undefined);

  const onReset = () => {
    const range = rangeUtil.convertRawToRange({ from: committed.from, to: committed.to }, ancestorTimeZone);
    host.state.$timeRange.onTimeRangeChange(range);
    setUseNotebookTime(cell.state.$timeRange === undefined);
  };

  const onApply = () => {
    // setCellTimeRange (called via onTimeRangeChange) already runs the query itself, in both the
    // editing and non-editing branches — an extra call here would run it twice.
    cell.onTimeRangeChange(useNotebookTime ? undefined : buildCellTimeRangeSpec(host.state.$timeRange));
    onClose();
  };

  const onToggle = (checked: boolean) => {
    setUseNotebookTime(checked);
    if (checked) {
      const ancestor = seedFromAncestor(cell);
      const range = rangeUtil.convertRawToRange({ from: ancestor.from, to: ancestor.to }, ancestorTimeZone);
      host.state.$timeRange.onTimeRangeChange(range);
    }
  };

  return (
    <Stack direction="column" gap={2}>
      <Box display="flex" alignItems="center" justifyContent="flex-end" gap={1}>
        <span>{t('notebook.cell.time-range.use-notebook-time', 'Use notebook time range')}</span>
        <Switch value={useNotebookTime} onChange={(e) => onToggle(e.currentTarget.checked)} />
      </Box>
      <div className={cx(styles.picker, useNotebookTime && styles.pickerDisabled)} aria-disabled={useNotebookTime}>
        {/* hideTimeSettings (set in buildDraftTimeRangeHost) hides the timezone/fiscal-year footer,
            so neither is ever editable per cell — timezone always follows the notebook. */}
        <host.state.timePicker.Component model={host.state.timePicker} />
      </div>
      <Box marginTop={1}>
        <Stack justifyContent="flex-end">
          <Button size="sm" variant="secondary" onClick={onReset}>
            {t('notebook.cell.time-range.reset', 'Reset')}
          </Button>
          <Button size="sm" variant="primary" onClick={onApply}>
            {t('common.apply', 'Apply')}
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
}

// The range this cell would use with no override of its own. Starts from the cell's *parent*, since
// sceneGraph.getTimeRange checks the object it's given first — starting at the cell would just
// return its own still-set `$timeRange` instead of skipping to the notebook's ambient range.
function seedFromAncestor(cell: NotebookCellItem): CellTimeRangeSpec {
  const { from, to } = sceneGraph.getTimeRange(cell.parent ?? cell).state;
  return { from, to };
}

// As seedFromAncestor: starts from the cell's parent so a still-set override on the cell itself
// isn't picked up in its place.
function getAncestorTimeZone(cell: NotebookCellItem): string {
  return sceneGraph.getTimeRange(cell.parent ?? cell).getTimeZone();
}

function getQuickRanges(cell: NotebookCellItem): TimeOption[] | undefined {
  let parent = cell.parent;

  while (parent) {
    if (isNotebookScene(parent)) {
      const { quickRanges, defaultQuickRanges } = parent.state.timePicker.state;
      return quickRanges ?? defaultQuickRanges;
    }
    parent = parent.parent;
  }

  return undefined;
}

const getStyles = (_theme: GrafanaTheme2) => ({
  picker: css({
    display: 'flex',
    justifyContent: 'flex-end',
  }),
  pickerDisabled: css({
    opacity: 0.5,
    pointerEvents: 'none',
  }),
});
