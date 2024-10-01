import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import React, { memo, createRef, useState, useEffect, useMemo, useCallback } from 'react';

import {
  rangeUtil,
  GrafanaTheme2,
  dateTimeFormat,
  timeZoneFormatUserFriendly,
  TimeRange,
  TimeZone,
  dateMath,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
// import uuid from 'uuid';

import { useStyles2 } from '../../themes/ThemeContext';
import { t, Trans } from '../../utils/i18n';
import { ButtonGroup } from '../Button';
import { getModalStyles } from '../Modal/getModalStyles';
import { ToolbarButton, ToolbarButtonVariant } from '../ToolbarButton';
import { Tooltip } from '../Tooltip/Tooltip';

import { TimePickerContent } from './TimeRangePicker/TimePickerContent';
import { WeekStart } from './WeekStartPicker';
import { quickOptions } from './options';
// import { getAppEvents, TimePickerUpdatedEvent } from '@grafana/runtime';
// import { time } from 'logfmt';

type TimeRangeContextValue = {
  syncedValue?: TimeRange;
  synced: boolean;
  syncPossible: boolean;
  addPicker(): void;
  removePicker(): void;
  sync(value: TimeRange): void;
  unSync(): void;
  setValue(timeRange: TimeRange): void;
};

const TimeRangeContext = React.createContext<TimeRangeContextValue | undefined>(undefined);

export function TimeRangeProvider({ children }: { children: React.ReactNode }) {
  const [pickersCount, setPickersCount] = useState(0);
  const [synced, setSynced] = useState(false);
  const [syncedValue, setSyncedValue] = useState<TimeRange>();

  const sync = useCallback((value: TimeRange) => {
    setSynced(true);
    setSyncedValue(value);
  }, []);

  const unSync = useCallback(() => {
    setSynced(false);
    setSyncedValue(undefined);
  }, []);

  const setValue = useCallback((value: TimeRange) => {
    setSyncedValue(value);
  }, []);

  const contextVal = useMemo(() => {
    return {
      sync,
      unSync,
      setValue,
      addPicker: () => setPickersCount(pickersCount + 1),
      removePicker: () => setPickersCount(pickersCount - 1),
      syncPossible: pickersCount > 1,
      synced,
      syncedValue,
    };
  }, [pickersCount, setValue, sync, unSync, synced, syncedValue]);

  return <TimeRangeContext.Provider value={contextVal}>{children}</TimeRangeContext.Provider>;
}

function useTimeRangeContext(initialSyncValue?: TimeRange) {
  const context = React.useContext(TimeRangeContext);

  useEffect(() => {
    if (context) {
      context.addPicker();
      if (initialSyncValue) {
        context.sync(initialSyncValue);
      }
      return () => {
        context.removePicker();
      };
    }
    return () => {};
  }, []);

  return useMemo(() => {
    if (!context) {
      return context;
    }

    // We just remove the addPicker/removePicker as that is done automatically here
    return {
      sync: context.sync,
      unSync: context.unSync,
      setValue: context.setValue,
      syncPossible: context.syncPossible,
      synced: context.synced,
      syncedValue: context.syncedValue,
    };
  }, [context]);
}

/** @public */
export interface TimeRangePickerProps {
  hideText?: boolean;
  value: TimeRange;
  timeZone?: TimeZone;
  fiscalYearStartMonth?: number;
  timeSyncButton?: JSX.Element;

  isSynced?: boolean;
  initialIsSynced?: boolean;

  onChange: (timeRange: TimeRange) => void;
  onChangeTimeZone: (timeZone: TimeZone) => void;
  onChangeFiscalYearStartMonth?: (month: number) => void;
  onMoveBackward: () => void;
  onMoveForward: () => void;
  onZoom: () => void;
  onError?: (error?: string) => void;
  history?: TimeRange[];
  hideQuickRanges?: boolean;
  widthOverride?: number;
  isOnCanvas?: boolean;
  onToolbarTimePickerClick?: () => void;
  /** Which day of the week the calendar should start on. Possible values: "saturday", "sunday" or "monday" */
  weekStart?: WeekStart;
}

export interface State {
  isOpen: boolean;
}

export function TimeRangePicker(props: TimeRangePickerProps) {
  const [isOpen, setOpen] = useState(false);

  const {
    value,
    onMoveBackward,
    onMoveForward,
    onZoom,
    onError,
    timeZone,
    fiscalYearStartMonth,
    timeSyncButton,
    history,
    onChangeTimeZone,
    onChangeFiscalYearStartMonth,
    hideQuickRanges,
    widthOverride,
    isOnCanvas,
    onToolbarTimePickerClick,
    weekStart,
    initialIsSynced,
  } = props;

  const timeRangeContext = useTimeRangeContext(initialIsSynced && value ? value : undefined);

  const usingTimeRangeContext = props.isSynced === undefined && timeRangeContext;

  // const appEvents = getAppEvents();
  // const propsIsSynced = props.isSynced;
  const propsOnChange = props.onChange;
  // const [isSynced, setIsSynced] = useState(!!initialIsSynced)

  const onChange = (timeRange: TimeRange) => {
    props.onChange(timeRange);
    // if (propsIsSynced === undefined) {
    //   appEvents.publish(new TimePickerUpdatedEvent({ timeRange, synced: isSynced }));
    // }

    if (usingTimeRangeContext && timeRangeContext?.synced) {
      timeRangeContext?.setValue(timeRange);
    }

    setOpen(false);
  };

  useEffect(() => {
    if (
      usingTimeRangeContext &&
      timeRangeContext.synced &&
      timeRangeContext.syncedValue &&
      timeRangeContext.syncedValue !== value
    ) {
      propsOnChange(timeRangeContext.syncedValue);
    }
  }, [usingTimeRangeContext, timeRangeContext?.synced, timeRangeContext?.syncedValue, value, propsOnChange]);

  useEffect(() => {
    if (isOpen && onToolbarTimePickerClick) {
      onToolbarTimePickerClick();
    }
  }, [isOpen, onToolbarTimePickerClick]);

  // useEffect(() => {
  //   if (propsIsSynced !== undefined) {
  //     return;
  //   }
  //
  //   const sub = appEvents.subscribe(TimePickerUpdatedEvent, (event) => {
  //     setIsSynced(event.payload.synced);
  //     if (event.payload.synced) {
  //       propsOnChange(event.payload.timeRange);
  //     }
  //   });
  //   return () => {
  //     sub.unsubscribe();
  //   }
  // }, [appEvents, propsIsSynced, propsOnChange]);

  const onToolbarButtonSwitch = () => {
    setOpen((prevState) => !prevState);
  };

  const onClose = () => {
    setOpen(false);
  };

  const overlayRef = createRef<HTMLElement>();
  const buttonRef = createRef<HTMLElement>();
  const { overlayProps, underlayProps } = useOverlay(
    {
      onClose,
      isDismissable: true,
      isOpen,
      shouldCloseOnInteractOutside: (element) => {
        return !buttonRef.current?.contains(element);
      },
    },
    overlayRef
  );
  const { dialogProps } = useDialog({}, overlayRef);

  const styles = useStyles2(getStyles);
  const { modalBackdrop } = useStyles2(getModalStyles);
  const hasAbsolute = !rangeUtil.isRelativeTime(value.raw.from) || !rangeUtil.isRelativeTime(value.raw.to);

  // const variant = isSynced ? 'active' : isOnCanvas ? 'canvas' : 'default';
  let variant: ToolbarButtonVariant = props.isSynced ? 'active' : isOnCanvas ? 'canvas' : 'default';
  if (usingTimeRangeContext) {
    variant = timeRangeContext?.synced ? 'active' : isOnCanvas ? 'canvas' : 'default';
  }

  const isFromAfterTo = value?.to?.isBefore(value.from);
  const timePickerIcon = isFromAfterTo ? 'exclamation-triangle' : 'clock-nine';

  const currentTimeRange = formattedRange(value, timeZone);

  return (
    <ButtonGroup className={styles.container}>
      {hasAbsolute && (
        <ToolbarButton
          aria-label={t('time-picker.range-picker.backwards-time-aria-label', 'Move time range backwards')}
          variant={variant}
          onClick={onMoveBackward}
          icon="angle-left"
          narrow
        />
      )}

      <Tooltip
        ref={buttonRef}
        content={<TimePickerTooltip timeRange={value} timeZone={timeZone} />}
        placement="bottom"
        interactive
      >
        <ToolbarButton
          data-testid={selectors.components.TimePicker.openButton}
          aria-label={t('time-picker.range-picker.current-time-selected', 'Time range selected: {{currentTimeRange}}', {
            currentTimeRange,
          })}
          aria-controls="TimePickerContent"
          onClick={onToolbarButtonSwitch}
          icon={timePickerIcon}
          isOpen={isOpen}
          variant={variant}
        >
          <TimePickerButtonLabel {...props} />
        </ToolbarButton>
      </Tooltip>
      {isOpen && (
        <div data-testid={selectors.components.TimePicker.overlayContent}>
          <div role="presentation" className={cx(modalBackdrop, styles.backdrop)} {...underlayProps} />
          <FocusScope contain autoFocus restoreFocus>
            <section className={styles.content} ref={overlayRef} {...overlayProps} {...dialogProps}>
              <TimePickerContent
                timeZone={timeZone}
                fiscalYearStartMonth={fiscalYearStartMonth}
                value={value}
                onChange={onChange}
                quickOptions={quickOptions}
                history={history}
                showHistory
                widthOverride={widthOverride}
                onChangeTimeZone={onChangeTimeZone}
                onChangeFiscalYearStartMonth={onChangeFiscalYearStartMonth}
                hideQuickRanges={hideQuickRanges}
                onError={onError}
                weekStart={weekStart}
              />
            </section>
          </FocusScope>
        </div>
      )}

      {usingTimeRangeContext
        ? timeRangeContext?.syncPossible && (
            <TimeSyncButton
              isSynced={timeRangeContext.synced}
              onClick={() => (timeRangeContext?.synced ? timeRangeContext.unSync() : timeRangeContext.sync(value))}
            />
          )
        : timeSyncButton}

      {hasAbsolute && (
        <ToolbarButton
          aria-label={t('time-picker.range-picker.forwards-time-aria-label', 'Move time range forwards')}
          onClick={onMoveForward}
          icon="angle-right"
          narrow
          variant={variant}
        />
      )}

      <Tooltip content={ZoomOutTooltip} placement="bottom">
        <ToolbarButton
          aria-label={t('time-picker.range-picker.zoom-out-button', 'Zoom out time range')}
          onClick={onZoom}
          icon="search-minus"
          variant={variant}
        />
      </Tooltip>
    </ButtonGroup>
  );
}

TimeRangePicker.displayName = 'TimeRangePicker';

const ZoomOutTooltip = () => (
  <>
    <Trans i18nKey="time-picker.range-picker.zoom-out-tooltip">
      Time range zoom out <br /> CTRL+Z
    </Trans>
  </>
);

export const TimePickerTooltip = ({ timeRange, timeZone }: { timeRange: TimeRange; timeZone?: TimeZone }) => {
  const styles = useStyles2(getLabelStyles);

  return (
    <>
      {dateTimeFormat(timeRange.from, { timeZone })}
      <div className="text-center">
        <Trans i18nKey="time-picker.range-picker.to">to</Trans>
      </div>
      {dateTimeFormat(timeRange.to, { timeZone })}
      <div className="text-center">
        <span className={styles.utc}>{timeZoneFormatUserFriendly(timeZone)}</span>
      </div>
    </>
  );
};

type LabelProps = Pick<TimeRangePickerProps, 'hideText' | 'value' | 'timeZone'>;

export const TimePickerButtonLabel = memo<LabelProps>(({ hideText, value, timeZone }) => {
  const styles = useStyles2(getLabelStyles);

  if (hideText) {
    return null;
  }

  return (
    <span className={styles.container} aria-live="polite" aria-atomic="true">
      <span>{formattedRange(value, timeZone)}</span>
      <span className={styles.utc}>{rangeUtil.describeTimeRangeAbbreviation(value, timeZone)}</span>
    </span>
  );
});

TimePickerButtonLabel.displayName = 'TimePickerButtonLabel';

const formattedRange = (value: TimeRange, timeZone?: TimeZone) => {
  const adjustedTimeRange = {
    to: dateMath.isMathString(value.raw.to) ? value.raw.to : value.to,
    from: dateMath.isMathString(value.raw.from) ? value.raw.from : value.from,
  };
  return rangeUtil.describeTimeRange(adjustedTimeRange, timeZone);
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      position: 'relative',
      display: 'flex',
      verticalAlign: 'middle',
    }),
    backdrop: css({
      display: 'none',
      [theme.breakpoints.down('sm')]: {
        display: 'block',
      },
    }),
    content: css({
      position: 'absolute',
      right: 0,
      top: '116%',
      zIndex: theme.zIndex.dropdown,

      [theme.breakpoints.down('sm')]: {
        position: 'fixed',
        right: '50%',
        top: '50%',
        transform: 'translate(50%, -50%)',
        zIndex: theme.zIndex.modal,
      },
    }),
  };
};

const getLabelStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      alignItems: 'center',
      whiteSpace: 'nowrap',
    }),
    utc: css({
      color: theme.v1.palette.orange,
      fontSize: theme.typography.size.sm,
      paddingLeft: '6px',
      lineHeight: '28px',
      verticalAlign: 'bottom',
      fontWeight: theme.typography.fontWeightMedium,
    }),
  };
};

interface TimeSyncButtonProps {
  isSynced: boolean;
  onClick: () => void;
}

function TimeSyncButton(props: TimeSyncButtonProps) {
  const { onClick, isSynced } = props;

  const syncTimesTooltip = () => {
    const { isSynced } = props;
    const tooltip = isSynced ? 'Unsync all views' : 'Sync all views to this time range';
    return <>{tooltip}</>;
  };

  return (
    <Tooltip content={syncTimesTooltip} placement="bottom">
      <ToolbarButton
        icon="link"
        variant={isSynced ? 'active' : 'canvas'}
        aria-label={isSynced ? 'Synced times' : 'Unsynced times'}
        onClick={onClick}
      />
    </Tooltip>
  );
}
