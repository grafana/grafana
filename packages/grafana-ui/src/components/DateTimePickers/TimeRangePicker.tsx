import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import React, { memo, FormEvent, createRef, useState } from 'react';

import {
  isDateTime,
  rangeUtil,
  GrafanaTheme2,
  dateTimeFormat,
  timeZoneFormatUserFriendly,
  TimeRange,
  TimeZone,
  dateMath,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { t, Trans } from '../../utils/i18n';
import { ButtonGroup } from '../Button';
import { getModalStyles } from '../Modal/getModalStyles';
import { ToolbarButton } from '../ToolbarButton';
import { Tooltip } from '../Tooltip/Tooltip';

import { TimePickerContent } from './TimeRangePicker/TimePickerContent';
import { quickOptions } from './options';

/** @public */
export interface TimeRangePickerProps {
  hideText?: boolean;
  value: TimeRange;
  timeZone?: TimeZone;
  fiscalYearStartMonth?: number;
  timeSyncButton?: JSX.Element;
  isSynced?: boolean;
  onChange: (timeRange: TimeRange) => void;
  onChangeTimeZone: (timeZone: TimeZone) => void;
  onChangeFiscalYearStartMonth?: (month: number) => void;
  onMoveBackward: () => void;
  onMoveForward: () => void;
  onZoom: () => void;
  history?: TimeRange[];
  hideQuickRanges?: boolean;
  widthOverride?: number;
  isOnCanvas?: boolean;
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
    timeZone,
    fiscalYearStartMonth,
    timeSyncButton,
    isSynced,
    history,
    onChangeTimeZone,
    onChangeFiscalYearStartMonth,
    hideQuickRanges,
    widthOverride,
    isOnCanvas,
  } = props;

  const onChange = (timeRange: TimeRange) => {
    props.onChange(timeRange);
    setOpen(false);
  };

  const onOpen = (event: FormEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    setOpen(!isOpen);
  };

  const onClose = () => {
    setOpen(false);
  };

  const ref = createRef<HTMLElement>();
  const { overlayProps, underlayProps } = useOverlay({ onClose, isDismissable: true, isOpen }, ref);
  const { dialogProps } = useDialog({}, ref);

  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { modalBackdrop } = getModalStyles(theme);
  const hasAbsolute = isDateTime(value.raw.from) || isDateTime(value.raw.to);
  const variant = isSynced ? 'active' : isOnCanvas ? 'canvas' : 'default';

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

      <Tooltip content={<TimePickerTooltip timeRange={value} timeZone={timeZone} />} placement="bottom" interactive>
        <ToolbarButton
          data-testid={selectors.components.TimePicker.openButton}
          aria-label={t('time-picker.range-picker.current-time-selected', 'Time range selected: {{currentTimeRange}}', {
            currentTimeRange,
          })}
          aria-controls="TimePickerContent"
          onClick={onOpen}
          icon="clock-nine"
          isOpen={isOpen}
          variant={variant}
        >
          <TimePickerButtonLabel {...props} />
        </ToolbarButton>
      </Tooltip>
      {isOpen && (
        <div>
          <div role="presentation" className={cx(modalBackdrop, styles.backdrop)} {...underlayProps} />
          <FocusScope contain autoFocus>
            <section className={styles.content} ref={ref} {...overlayProps} {...dialogProps}>
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
              />
            </section>
          </FocusScope>
        </div>
      )}

      {timeSyncButton}

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
    <span className={styles.container}>
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
    container: css`
      position: relative;
      display: flex;
      vertical-align: middle;
    `,
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
    container: css`
      display: flex;
      align-items: center;
      white-space: nowrap;
    `,
    utc: css`
      color: ${theme.v1.palette.orange};
      font-size: ${theme.typography.size.sm};
      padding-left: 6px;
      line-height: 28px;
      vertical-align: bottom;
      font-weight: ${theme.typography.fontWeightMedium};
    `,
  };
};
