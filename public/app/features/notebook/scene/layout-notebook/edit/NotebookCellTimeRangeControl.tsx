import { css } from '@emotion/css';
import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/react';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import { uniqBy } from 'lodash';
import { type Ref, useEffect, useRef, useState } from 'react';

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
import {
  Button,
  Icon,
  IconButton,
  getPortalContainer,
  Portal,
  TimePickerTooltip,
  Tooltip,
  useStyles2,
} from '@grafana/ui';

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
  popoverAlign?: 'start' | 'end';
  isEditing?: boolean;
  buttonRef?: Ref<HTMLElement>;
  onClear?: () => void;
  onOpenChange?: (open: boolean) => void;
}

export function NotebookCellTimeRangeControl({
  cell,
  popoverAlign = 'end',
  isEditing = true,
  buttonRef,
  onClear,
  onOpenChange,
}: Props) {
  const { $timeRange } = cell.useState();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    onOpenChange?.(open);
    return () => onOpenChange?.(false);
  }, [open, onOpenChange]);
  const styles = useStyles2(getStyles);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const overlayRef = useRef<HTMLElement>(null);
  const { refs, floatingStyles } = useFloating({
    open,
    placement: `bottom-${popoverAlign}`,
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight, elements }) {
          elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`;
        },
      }),
    ],
  });

  const { overlayProps, underlayProps } = useOverlay(
    {
      isOpen: open,
      onClose: () => setOpen(false),
      isDismissable: true,
      shouldCloseOnInteractOutside: (element) =>
        !triggerRef.current?.contains(element) && !getPortalContainer().contains(element),
    },
    overlayRef
  );
  const { dialogProps } = useDialog(
    { 'aria-label': t('notebook.cell.time-range.dialog-label', 'Cell time range') },
    overlayRef
  );

  const ancestorTimeZone = getAncestorTimeZone(cell);
  const fiscalYearStartMonth = getAncestorFiscalYearStartMonth(cell);
  const committed = $timeRange ? buildCellTimeRangeSpec($timeRange) : seedFromAncestor(cell);
  const value = rangeUtil.convertRawToRange(
    { from: committed.from, to: committed.to },
    ancestorTimeZone,
    fiscalYearStartMonth
  );

  const lockedLabel = t('notebook.cell.time-range.locked', 'Locked: {{range}}', {
    range: rangeUtil.describeTimeRange(committed, ancestorTimeZone, getQuickRanges(cell)),
    interpolation: { escapeValue: false },
  });

  const clearTimeLock = () => {
    onClear?.();
    cell.onTimeRangeChange(undefined);
    setOpen(false);
  };
  const lockedContent = (
    <>
      <Icon name="lock" size="sm" />
      <span className={styles.labelText}>{lockedLabel}</span>
    </>
  );
  const rawTrigger = $timeRange ? (
    isEditing ? (
      <button
        type="button"
        className={styles.label}
        aria-label={lockedLabel}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {lockedContent}
      </button>
    ) : (
      <span className={styles.label}>{lockedContent}</span>
    )
  ) : (
    <IconButton
      name="clock-nine"
      size="sm"
      variant="secondary"
      aria-label={t('notebook.cell.time-range.button', 'Update time range')}
      aria-expanded={open}
      onClick={() => setOpen(!open)}
    />
  );

  const trigger = (
    <Tooltip
      ref={!$timeRange ? buttonRef : undefined}
      content={
        $timeRange ? (
          <TimePickerTooltip timeRange={value} timeZone={ancestorTimeZone} />
        ) : (
          t('notebook.cell.time-range.tooltip-default', 'Lock panel time range')
        )
      }
      placement="bottom"
      interactive
      show={open ? false : undefined}
    >
      {rawTrigger}
    </Tooltip>
  );

  return (
    <span className={styles.container}>
      <span
        ref={(element) => {
          triggerRef.current = element;
          refs.setReference(element);
        }}
        className={styles.trigger}
      >
        {$timeRange ? (
          <span className={styles.pill}>
            {trigger}
            {isEditing && <span className={styles.separator} />}
            {isEditing && (
              <IconButton
                className={styles.clearButton}
                name="times"
                size="sm"
                tooltip={t('notebook.cell.time-range.remove-lock', 'Remove time lock')}
                aria-label={t('notebook.cell.time-range.remove-lock', 'Remove time lock')}
                onClick={clearTimeLock}
              />
            )}
          </span>
        ) : (
          trigger
        )}
      </span>
      {open && isEditing && (
        <>
          <div
            role="presentation"
            data-testid="notebook-cell-time-range-backdrop"
            className={styles.backdrop}
            {...underlayProps}
          />
          <Portal>
            <FocusScope contain autoFocus restoreFocus>
              <section
                className={styles.content}
                style={floatingStyles}
                ref={(element) => {
                  overlayRef.current = element;
                  refs.setFloating(element);
                }}
                {...overlayProps}
                {...dialogProps}
                aria-label={t('notebook.cell.time-range.dialog', 'Panel time range')}
              >
                {$timeRange && (
                  <div className={styles.clearAction}>
                    <span>{lockedLabel}</span>
                    <Button
                      variant="secondary"
                      fill="text"
                      size="sm"
                      icon="times"
                      iconPlacement="right"
                      onClick={clearTimeLock}
                    >
                      {t('notebook.cell.time-range.remove-lock', 'Remove time lock')}
                    </Button>
                  </div>
                )}
                <NotebookCellTimeRangePopoverContent cell={cell} onClose={() => setOpen(false)} />
              </section>
            </FocusScope>
          </Portal>
        </>
      )}
    </span>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    maxWidth: '100%',
    minWidth: 0,
    height: theme.spacing(theme.components.height.sm),
  }),
  trigger: css({
    display: 'inline-flex',
    alignItems: 'center',
    minWidth: 0,
    maxWidth: '100%',
  }),
  content: css({
    overflowY: 'auto',
    maxWidth: `calc(100vw - ${theme.spacing(2)})`,
    zIndex: theme.zIndex.dropdown,
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.lg,
    boxShadow: theme.shadows.z3,
    [theme.breakpoints.down('sm')]: {
      zIndex: theme.zIndex.modal,
    },
  }),
  picker: css({
    border: 0,
    borderRadius: 'unset',
    boxShadow: 'none',
  }),
  clearAction: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(0.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(1),
  }),
  backdrop: css({
    display: 'none',
    [theme.breakpoints.down('sm')]: {
      display: 'block',
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: theme.zIndex.modalBackdrop,
      backgroundColor: theme.components.overlay.background,
    },
  }),
  pill: css({
    display: 'inline-flex',
    alignItems: 'center',
    minWidth: 0,
    maxWidth: '100%',
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
    fontSize: theme.typography.bodySmall.fontSize,
    minWidth: 0,
    maxWidth: '100%',
    padding: theme.spacing(0, 1),
    whiteSpace: 'nowrap',
    '& > svg': { flexShrink: 0 },
    '&:is(button)': { cursor: 'pointer' },
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: '2px',
    },
  }),
  labelText: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
  clearButton: css({
    flexShrink: 0,
  }),
  separator: css({
    width: '1px',
    flexShrink: 0,
    height: theme.spacing(2),
    background: theme.colors.border.weak,
    marginRight: theme.spacing(1),
  }),
});

function NotebookCellTimeRangePopoverContent({ cell, onClose }: { cell: NotebookCellItem; onClose: () => void }) {
  const styles = useStyles2(getStyles);
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
            className={styles.picker}
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
