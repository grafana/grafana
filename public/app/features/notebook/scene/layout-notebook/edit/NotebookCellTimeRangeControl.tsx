import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2, rangeUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';
import { Box, Button, IconButton, Stack, Switch, TimeRangePicker, Toggletip, useStyles2 } from '@grafana/ui';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';

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
          {t('notebook.cell.time-range.locked', 'Locked: {{from}} → {{to}}', {
            from: $timeRange.state.from,
            to: $timeRange.state.to,
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

function noop() {}

function NotebookCellTimeRangePopoverContent({ cell, onClose }: { cell: NotebookCellItem; onClose: () => void }) {
  const styles = useStyles2(getStyles);
  // Timezone always follows the notebook, never the cell — same convention as a dashboard panel's
  // own time override (PanelTimeRange), which never owns its timezone either. This is a one-time
  // snapshot for the draft's own internal date math only — never persisted, never editable here.
  const ancestorTimeZone = sceneGraph.getTimeRange(cell.parent ?? cell).getTimeZone();
  const committed = cell.state.$timeRange ? buildCellTimeRangeSpec(cell.state.$timeRange) : seedFromAncestor(cell);

  const [host] = useState(() => buildDraftTimeRangeHost(committed.from, committed.to, ancestorTimeZone));
  const { value } = host.state.$timeRange.useState();
  const [useNotebookTime, setUseNotebookTime] = useState(cell.state.$timeRange === undefined);

  const onReset = () => {
    const range = rangeUtil.convertRawToRange({ from: committed.from, to: committed.to }, ancestorTimeZone);
    host.state.$timeRange.onTimeRangeChange(range);
    setUseNotebookTime(cell.state.$timeRange === undefined);
  };

  const onApply = () => {
    cell.onTimeRangeChange(useNotebookTime ? undefined : buildCellTimeRangeSpec(host.state.$timeRange));
    getQueryRunnerFor(cell.state.body)?.runQueries();
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
        {/* TimeRangePicker directly, not SceneTimePicker.Component: omitting timeZone/fiscalYearStartMonth
            hides its "Change time settings" footer entirely, so neither is ever editable per cell. */}
        <TimeRangePicker
          value={value}
          onChange={(range) => host.state.$timeRange.onTimeRangeChange(range)}
          onChangeTimeZone={noop}
          onMoveBackward={() => host.state.timePicker.onMoveBackward()}
          onMoveForward={() => host.state.timePicker.onMoveForward()}
          onZoom={() => host.state.timePicker.onZoom()}
        />
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
