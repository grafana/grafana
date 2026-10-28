import { css, cx } from '@emotion/css';
import { autoUpdate, offset, useFloating } from '@floating-ui/react';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import { memo, useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { useMedia } from 'react-use';

import {
  rangeUtil,
  type GrafanaTheme2,
  dateTimeFormat,
  type TimeOption,
  type TimeRange,
  dateMath,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { type TimeZone } from '@grafana/schema';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { getPositioningMiddleware } from '../../utils/floating';
import { ButtonGroup } from '../Button/ButtonGroup';
import { Stack } from '../Layout/Stack/Stack';
import { getModalStyles } from '../Modal/getModalStyles';
import { getPortalContainer, Portal } from '../Portal/Portal';
import { ToolbarButton } from '../ToolbarButton/ToolbarButton';
import { Tooltip } from '../Tooltip/Tooltip';

import { TimePickerContent } from './TimeRangePicker/TimePickerContent';
import { TimeZoneDescription } from './TimeZonePicker/TimeZoneDescription';
import { getTimeZoneTitle } from './TimeZonePicker/TimeZoneTitle';
import { getTimeZoneDisplayInfo } from './TimeZonePicker/timeZoneUtils';
import { type WeekStart } from './WeekStartPicker';
import { getQuickOptions } from './options';
import { useTimeSync } from './utils/useTimeSync';

/** @public */
export interface TimeRangePickerProps {
  hideText?: boolean;
  value: TimeRange;
  timeZone?: TimeZone;
  fiscalYearStartMonth?: number;
  hideTimeZone?: boolean;

  /**
   * If you handle sync state between pickers yourself use this prop to pass the sync button component.
   * Otherwise, a default one will show automatically if sync is possible.
   */
  timeSyncButton?: JSX.Element;

  // Use to manually set the synced styles for the time range picker if you need to control the sync state yourself.
  isSynced?: boolean;

  /**
   * @deprecated Only had an effect inside a `TimeRangeProvider`, which was gated by the
   * removed `timeRangeProvider` feature flag. This prop is now a no-op and will be
   * removed in the next major version of `@grafana/ui`.
   */
  initialIsSynced?: boolean;

  onChange: (timeRange: TimeRange) => void;
  onChangeTimeZone: (timeZone: TimeZone) => void;
  onChangeFiscalYearStartMonth?: (month: number) => void;
  onMoveBackward: () => void;
  onMoveForward: () => void;
  moveForwardTooltip?: string;
  moveBackwardTooltip?: string;
  onZoom: () => void;
  onError?: (error?: string) => void;
  history?: TimeRange[];
  quickRanges?: TimeOption[];
  hideQuickRanges?: boolean;
  widthOverride?: number;
  isOnCanvas?: boolean;
  onToolbarTimePickerClick?: () => void;
  /** Which day of the week the calendar should start on. Possible values: "saturday", "sunday" or "monday" */
  weekStart?: WeekStart;
}

/**
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/date-time-pickers-timerangepicker--docs
 */
export function TimeRangePicker(props: TimeRangePickerProps) {
  const [isOpen, setOpen] = useState(false);

  const {
    value,
    onMoveBackward,
    onMoveForward,
    moveForwardTooltip,
    moveBackwardTooltip,
    onZoom,
    onError,
    timeZone,
    fiscalYearStartMonth,
    hideTimeZone,
    history,
    onChangeTimeZone,
    onChangeFiscalYearStartMonth,
    quickRanges,
    hideQuickRanges,
    widthOverride,
    isOnCanvas = true,
    onToolbarTimePickerClick,
    weekStart,
    initialIsSynced,
  } = props;

  // TODO: Inline manual-prop passthrough and drop initialIsSynced when TimeRangeProvider is removed.
  const { onChangeWithSync, isSynced, timeSyncButton } = useTimeSync({
    initialIsSynced,
    value,
    onChangeProp: props.onChange,
    isSyncedProp: props.isSynced,
    timeSyncButtonProp: props.timeSyncButton,
  });

  const onChange = (timeRange: TimeRange) => {
    onChangeWithSync(timeRange);
    setOpen(false);
  };

  useEffect(() => {
    if (isOpen && onToolbarTimePickerClick) {
      onToolbarTimePickerClick();
    }
  }, [isOpen, onToolbarTimePickerClick]);

  const onToolbarButtonSwitch = () => {
    setOpen((prevState) => !prevState);
  };

  const onClose = () => {
    setOpen(false);
  };

  const overlayRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const theme = useTheme2();
  const isNarrow = useMedia(theme.breakpoints.down('sm').replace('@media ', ''));
  const placement = 'bottom-end';
  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    placement,
    strategy: 'fixed',
    // a transform would misplace fixed children, like the time zone Select menu.
    transform: false,
    middleware: [
      // gap of 16% of the reference height
      offset(({ rects }) => ({ mainAxis: rects.reference.height * 0.16 })),
      ...getPositioningMiddleware(placement),
    ],
    whileElementsMounted: autoUpdate,
  });
  const setOverlayRef = useCallback(
    (node: HTMLElement | null) => {
      overlayRef.current = node;
      refs.setFloating(node);
    },
    [refs]
  );
  const { overlayProps, underlayProps } = useOverlay(
    {
      onClose,
      isDismissable: true,
      isOpen,
      shouldCloseOnInteractOutside: (element) => {
        // the backdrop is in the portal container too, so check it first.
        if (backdropRef.current?.contains(element)) {
          return true;
        }
        const portalContainer = getPortalContainer();
        return !buttonRef.current?.contains(element) && !portalContainer.contains(element);
      },
    },
    overlayRef
  );
  const { dialogProps } = useDialog(
    { 'aria-label': t('time-picker.range-picker.dialog-label', 'Time range picker') },
    overlayRef
  );

  const styles = useStyles2(getStyles);
  const { modalBackdrop } = useStyles2(getModalStyles);

  const variant = isSynced ? 'active' : isOnCanvas ? 'canvas' : 'default';

  const isFromAfterTo = value?.to?.isBefore(value.from);
  const timePickerIcon = isFromAfterTo ? 'exclamation-triangle' : 'clock-nine';

  const currentTimeRange = formattedRange(value, timeZone, quickRanges);

  return (
    <ButtonGroup className={styles.container} ref={refs.setReference}>
      <ToolbarButton
        variant={variant}
        onClick={onMoveBackward}
        icon="angle-double-left"
        type="button"
        iconSize="xl"
        data-testid={selectors.components.TimePicker.moveBackwardButton}
        tooltip={
          moveBackwardTooltip ?? t('time-picker.range-picker.backwards-time-aria-label', 'Move time range backwards')
        }
        narrow
      />

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
          type="button"
          variant={variant}
        >
          <TimePickerButtonLabel {...props} />
        </ToolbarButton>
      </Tooltip>
      {isOpen && (
        <Portal zIndex={theme.zIndex.modal}>
          <div data-testid={selectors.components.TimePicker.overlayContent}>
            <div
              ref={backdropRef}
              role="presentation"
              className={cx(modalBackdrop, styles.backdrop)}
              {...underlayProps}
            />
            <FocusScope contain autoFocus restoreFocus>
              <section
                className={styles.content}
                ref={setOverlayRef}
                style={isNarrow ? undefined : floatingStyles}
                {...overlayProps}
                {...dialogProps}
              >
                <TimePickerContent
                  timeZone={timeZone}
                  fiscalYearStartMonth={fiscalYearStartMonth}
                  hideTimeZone={hideTimeZone}
                  value={value}
                  onChange={onChange}
                  quickOptions={quickRanges || getQuickOptions()}
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
        </Portal>
      )}

      {timeSyncButton}

      <ToolbarButton
        onClick={onMoveForward}
        icon="angle-double-right"
        type="button"
        variant={variant}
        iconSize="xl"
        data-testid={selectors.components.TimePicker.moveForwardButton}
        tooltip={
          moveForwardTooltip ?? t('time-picker.range-picker.forwards-time-aria-label', 'Move time range forwards')
        }
        narrow
      />

      <Tooltip content={ZoomOutTooltip} placement="bottom">
        <ToolbarButton
          aria-label={t('time-picker.range-picker.zoom-out-button', 'Zoom out time range')}
          onClick={onZoom}
          icon="search-minus"
          type="button"
          data-testid={selectors.components.TimePicker.zoomOut}
          variant={variant}
        />
      </Tooltip>
    </ButtonGroup>
  );
}

TimeRangePicker.displayName = 'TimeRangePicker';

const ZoomOutTooltip = () => {
  return (
    <Trans i18nKey="time-picker.range-picker.zoom-out-tooltip-new">
      Time range zoom out <br /> t -
    </Trans>
  );
};

export const TimePickerTooltip = ({ timeRange, timeZone }: { timeRange: TimeRange; timeZone?: TimeZone }) => {
  const styles = useStyles2(getLabelStyles);
  const now = Date.now();

  // Get timezone info only if timeZone is provided
  const timeZoneInfo = timeZone ? getTimeZoneDisplayInfo(timeZone, now) : undefined;

  return (
    <Stack alignItems="center" direction="column" gap={0}>
      <div className="text-center">
        {dateTimeFormat(timeRange.from, { timeZone })}
        <div className="text-center">
          <Trans i18nKey="time-picker.range-picker.to">to</Trans>
        </div>
        {dateTimeFormat(timeRange.to, { timeZone })}
      </div>
      <div className={styles.container}>
        <span className={styles.utc}>{timeZoneInfo ? getTimeZoneTitle(timeZoneInfo) : ''}</span>
        <TimeZoneDescription info={timeZoneInfo} />
      </div>
    </Stack>
  );
};

type LabelProps = Pick<TimeRangePickerProps, 'hideText' | 'value' | 'timeZone' | 'quickRanges'>;

export const TimePickerButtonLabel = memo<LabelProps>(({ hideText, value, timeZone, quickRanges }) => {
  const styles = useStyles2(getLabelStyles);

  if (hideText) {
    return null;
  }

  return (
    <span className={styles.container} aria-live="polite" aria-atomic="true">
      <span>{formattedRange(value, timeZone, quickRanges)}</span>
      <span className={styles.utc}>{rangeUtil.describeTimeRangeAbbreviation(value, timeZone)}</span>
    </span>
  );
});

TimePickerButtonLabel.displayName = 'TimePickerButtonLabel';

const formattedRange = (value: TimeRange, timeZone?: TimeZone, quickRanges?: TimeOption[]) => {
  const adjustedTimeRange = {
    to: dateMath.isMathString(value.raw.to) ? value.raw.to : value.to,
    from: dateMath.isMathString(value.raw.from) ? value.raw.from : value.from,
  };
  return rangeUtil.describeTimeRange(adjustedTimeRange, timeZone, quickRanges);
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
      zIndex: theme.zIndex.dropdown,

      // Wider viewports are positioned by useFloating.
      [theme.breakpoints.down('sm')]: {
        position: 'fixed',
        right: '50%',
        top: '50%',
        left: 'auto',
        transform: 'translate(50%, -50%)',
        zIndex: theme.zIndex.modal,
      },
    }),
  };
};

const getLabelStyles = (theme: GrafanaTheme2) => {
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;
  return {
    container: css({
      display: 'flex',
      alignItems: 'baseline',
      whiteSpace: 'nowrap',
      columnGap: theme.spacing(0.75),
    }),
    utc: css({
      color: visualRefreshEnabled ? theme.colors.tertiary.text : theme.colors.warning.text,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    }),
  };
};
