import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import { uniqBy } from 'lodash';
import { useRef, useState } from 'react';

import {
  isDateTime,
  LocalStorageValueProvider,
  type GrafanaTheme2,
  rangeUtil,
  type TimeOption,
  type TimeRange,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';
import { Icon, IconButton, useStyles2 } from '@grafana/ui';

import { TimePickerContent } from '../../../../../../../packages/grafana-ui/src/components/DateTimePickers/TimeRangePicker/TimePickerContent';
import { getQuickOptions } from '../../../../../../../packages/grafana-ui/src/components/DateTimePickers/options';
import { isNotebookScene } from '../../isNotebookScene';
import { type NotebookCellItem } from '../NotebookCellItem';
import { buildCellTimeRangeSpec, type CellTimeRangeSpec } from '../cellTimeRange';

// Same key TimePickerWithHistory uses, so "recently used absolute ranges" here is the same list a
// reader already sees on every other Grafana time picker, not a separate notebook-only one.
const HISTORY_LOCAL_STORAGE_KEY = 'grafana.dashboard.timepicker.history';
const MAX_HISTORY_ITEMS = 4;

interface Props {
  cell: NotebookCellItem;
}

// Same overlay mechanics TimeRangePicker itself uses for its own dropdown — an absolutely
// positioned panel next to a `position: relative` container, not Toggletip's tooltip-bubble chrome
// (border/background/arrow), which visually clashes with TimePickerContent's own panel styling.
export function NotebookCellTimeRangeControl({ cell }: Props) {
  const { $timeRange } = cell.useState();
  const [open, setOpen] = useState(false);
  const styles = useStyles2(getStyles);
  const containerRef = useRef<HTMLSpanElement>(null);
  const overlayRef = useRef<HTMLElement>(null);

  const { overlayProps } = useOverlay(
    {
      isOpen: open,
      onClose: () => setOpen(false),
      isDismissable: true,
      shouldCloseOnInteractOutside: (element) => !containerRef.current?.contains(element),
    },
    overlayRef
  );
  const { dialogProps } = useDialog({}, overlayRef);

  const trigger = $timeRange ? (
    <button type="button" className={styles.label} onClick={() => setOpen((prev) => !prev)}>
      <Icon name="lock" size="sm" />
      {t('notebook.cell.time-range.locked', 'Locked: {{range}}', {
        range: rangeUtil.describeTimeRange(
          { from: $timeRange.state.from, to: $timeRange.state.to },
          getAncestorTimeZone(cell),
          getQuickRanges(cell)
        ),
        interpolation: { escapeValue: false },
      })}
    </button>
  ) : (
    <IconButton
      name="clock-nine"
      size="sm"
      variant="secondary"
      tooltip={t('notebook.cell.time-range.tooltip-default', "Uses the notebook's time range")}
      aria-label={t('notebook.cell.time-range.button', 'Update time range')}
      onClick={() => setOpen((prev) => !prev)}
    />
  );

  return (
    <span className={styles.container} ref={containerRef}>
      {$timeRange ? (
        <span className={styles.pill}>
          {trigger}
          <span className={styles.separator} />
          <IconButton
            name="times"
            size="sm"
            tooltip={t('notebook.cell.time-range.sync-back', 'Sync back to notebook time range')}
            aria-label={t('notebook.cell.time-range.sync-back', 'Sync back to notebook time range')}
            onClick={() => cell.onTimeRangeChange(undefined)}
          />
        </span>
      ) : (
        trigger
      )}
      {open && (
        <FocusScope contain autoFocus restoreFocus>
          <section className={styles.content} ref={overlayRef} {...overlayProps} {...dialogProps}>
            <NotebookCellTimeRangePopoverContent cell={cell} onClose={() => setOpen(false)} />
          </section>
        </FocusScope>
      )}
    </span>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  }),
  content: css({
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: theme.spacing(0.5),
    zIndex: theme.zIndex.dropdown,
  }),
  pill: css({
    display: 'inline-flex',
    alignItems: 'center',
    height: theme.spacing(theme.components.height.sm),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    paddingRight: theme.spacing(0.5),
  }),
  label: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    height: '100%',
    border: 'none',
    background: 'transparent',
    color: theme.colors.text.primary,
    font: 'inherit',
    cursor: 'pointer',
    padding: theme.spacing(0, 1),
    whiteSpace: 'nowrap',
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: '2px',
    },
  }),
  separator: css({
    width: '1px',
    height: theme.spacing(2),
    background: theme.colors.border.weak,
    marginRight: theme.spacing(0.5),
  }),
});

function NotebookCellTimeRangePopoverContent({ cell, onClose }: { cell: NotebookCellItem; onClose: () => void }) {
  const ancestorTimeZone = getAncestorTimeZone(cell);
  const fiscalYearStartMonth = getAncestorFiscalYearStartMonth(cell);
  const committed = cell.state.$timeRange ? buildCellTimeRangeSpec(cell.state.$timeRange) : seedFromAncestor(cell);

  const [value, setValue] = useState<TimeRange>(() =>
    rangeUtil.convertRawToRange({ from: committed.from, to: committed.to }, ancestorTimeZone, fiscalYearStartMonth)
  );

  return (
    <LocalStorageValueProvider<TimePickerHistoryItem[]> storageKey={HISTORY_LOCAL_STORAGE_KEY} defaultValue={[]}>
      {(storedHistory, onSaveToStore) => {
        const validHistory = getValidHistory(storedHistory);

        return (
          <TimePickerContent
            value={value}
            onChange={(timeRange) => {
              setValue(timeRange);
              const spec = toRawSpec(timeRange);
              if (isAbsolute(timeRange)) {
                onSaveToStore(uniqBy([spec, ...validHistory], (v) => v.from + v.to).slice(0, MAX_HISTORY_ITEMS));
              }
              cell.onTimeRangeChange(spec);
              onClose();
            }}
            onChangeTimeZone={() => {}}
            timeZone={ancestorTimeZone}
            fiscalYearStartMonth={fiscalYearStartMonth}
            hideTimeZone
            quickOptions={getQuickRanges(cell) ?? getQuickOptions()}
            history={deserializeHistory(validHistory)}
            showHistory
            weekStart={getAncestorWeekStart(cell)}
          />
        );
      }}
    </LocalStorageValueProvider>
  );
}

interface TimePickerHistoryItem {
  from: string;
  to: string;
}

function toRawSpec(timeRange: TimeRange): CellTimeRangeSpec {
  return {
    from: typeof timeRange.raw.from === 'string' ? timeRange.raw.from : timeRange.raw.from.toISOString(),
    to: typeof timeRange.raw.to === 'string' ? timeRange.raw.to : timeRange.raw.to.toISOString(),
  };
}

function isAbsolute(timeRange: TimeRange): boolean {
  return isDateTime(timeRange.raw.from) || isDateTime(timeRange.raw.to);
}

function deserializeHistory(values: TimePickerHistoryItem[]): TimeRange[] {
  return values.map((item) => rangeUtil.convertRawToRange(item, 'utc', undefined, 'YYYY-MM-DD HH:mm:ss'));
}

function getValidHistory(values: unknown): TimePickerHistoryItem[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter(
    (item): item is TimePickerHistoryItem =>
      typeof item === 'object' &&
      item !== null &&
      Object.keys(item).length === 2 &&
      typeof item.from === 'string' &&
      typeof item.to === 'string'
  );
}

function seedFromAncestor(cell: NotebookCellItem): CellTimeRangeSpec {
  const { from, to } = sceneGraph.getTimeRange(cell.parent ?? cell).state;
  return { from, to };
}

function getAncestorTimeZone(cell: NotebookCellItem): string {
  return sceneGraph.getTimeRange(cell.parent ?? cell).getTimeZone();
}

function getAncestorFiscalYearStartMonth(cell: NotebookCellItem) {
  return sceneGraph.getTimeRange(cell.parent ?? cell).state.fiscalYearStartMonth;
}

function getAncestorWeekStart(cell: NotebookCellItem) {
  return sceneGraph.getTimeRange(cell.parent ?? cell).state.weekStart;
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
