import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2, rangeUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';
import { Box, Button, IconButton, Stack, Switch, Toggletip, useStyles2 } from '@grafana/ui';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';

import { type NotebookCellTimeRangeSpec } from '../../../types';
import { type NotebookCellItem } from '../NotebookCellItem';
import { buildCellTimeRangeSpec, buildDraftTimeRangeHost } from '../cellTimeRange';

interface Props {
  cell: NotebookCellItem;
  /** 'button': plain clock icon. 'label': descriptive "Locked: from → to" — callers only use this
   * once the cell actually has its own time range; PanelCell hides the trigger entirely otherwise. */
  variant: 'button' | 'label';
}

export function NotebookCellTimeRangeControl({ cell, variant }: Props) {
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
      {variant === 'label' && $timeRange ? (
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
          variant={$timeRange ? 'primary' : 'secondary'}
          tooltip={
            $timeRange
              ? t('notebook.cell.time-range.tooltip-override', 'Has its own time range')
              : t('notebook.cell.time-range.tooltip-default', "Uses the notebook's time range")
          }
          aria-label={t('notebook.cell.time-range.button', 'Update time range')}
        />
      )}
    </Toggletip>
  );
}

function NotebookCellTimeRangePopoverContent({ cell, onClose }: { cell: NotebookCellItem; onClose: () => void }) {
  const styles = useStyles2(getStyles);
  const committed = cell.state.$timeRange ? buildCellTimeRangeSpec(cell.state.$timeRange) : seedFromAncestor(cell);

  const [host] = useState(() => buildDraftTimeRangeHost(committed));
  const [useNotebookTime, setUseNotebookTime] = useState(cell.state.$timeRange === undefined);

  const onReset = () => {
    host.state.$timeRange.setState({
      timeZone: committed.timezone,
      fiscalYearStartMonth: committed.fiscalYearStartMonth,
    });
    const range = rangeUtil.convertRawToRange({ from: committed.from, to: committed.to }, committed.timezone);
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
      host.state.$timeRange.setState({
        timeZone: ancestor.timezone,
        fiscalYearStartMonth: ancestor.fiscalYearStartMonth,
      });
      const range = rangeUtil.convertRawToRange({ from: ancestor.from, to: ancestor.to }, ancestor.timezone);
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

function seedFromAncestor(cell: NotebookCellItem): NotebookCellTimeRangeSpec {
  const { from, to, timeZone, fiscalYearStartMonth } = sceneGraph.getTimeRange(cell.parent ?? cell).state;
  return { from, to, timezone: timeZone, fiscalYearStartMonth };
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
