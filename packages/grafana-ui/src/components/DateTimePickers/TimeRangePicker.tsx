import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import React, { memo, FormEvent, createRef, useState, ReactElement, ReactNode } from 'react';

import {
  isDateTime,
  rangeUtil,
  GrafanaTheme,
  dateTimeFormat,
  timeZoneFormatUserFriendly,
  TimeRange,
  TimeZone,
  dateMath,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { withTheme, useTheme } from '../../themes/ThemeContext';
import { stylesFactory } from '../../themes/stylesFactory';
import { Themeable } from '../../types';
import { ButtonGroup } from '../Button';
import { ToolbarButton } from '../ToolbarButton';
import { Tooltip } from '../Tooltip/Tooltip';

import { TimePickerContent } from './TimeRangePicker/TimePickerContent';
import { quickOptions } from './options';

/** @public */
export interface TimeRangePickerProps extends Themeable {
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
  fnText?: ReactNode;
}

export interface State {
  isOpen: boolean;
}

export function UnthemedTimeRangePicker(props: TimeRangePickerProps): ReactElement {
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
    theme,
    history,
    onChangeTimeZone,
    onChangeFiscalYearStartMonth,
    hideQuickRanges,
    widthOverride,
    fnText = '',
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
  const { overlayProps } = useOverlay({ onClose, isDismissable: true, isOpen }, ref);
  const { dialogProps } = useDialog({}, ref);

  const styles = getStyles(theme);
  const hasAbsolute = isDateTime(value.raw.from) || isDateTime(value.raw.to);
  const variant = isSynced ? 'active' : 'default';

  return (
    <ButtonGroup className={styles.container}>
      {hasAbsolute && (
        <ToolbarButton
          aria-label="Move time range backwards"
          variant={variant}
          onClick={onMoveBackward}
          icon="angle-left"
          narrow
        />
      )}

      <Tooltip content={<TimePickerTooltip timeRange={value} timeZone={timeZone} />} placement="bottom" interactive>
        <ToolbarButton
          data-testid={selectors.components.TimePicker.openButton}
          aria-label={`Time range picker with current time range ${formattedRange(value, timeZone)} selected`}
          aria-controls="TimePickerContent"
          onClick={onOpen}
          icon="clock-nine"
          isOpen={isOpen}
          variant={variant}
          fnText={fnText}
        >
          <TimePickerButtonLabel {...props} />
        </ToolbarButton>
      </Tooltip>
      {isOpen && (
        <FocusScope contain autoFocus>
          <section ref={ref} {...overlayProps} {...dialogProps}>
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
      )}

      {timeSyncButton}

      {hasAbsolute && (
        <ToolbarButton
          aria-label="Move time range forwards"
          onClick={onMoveForward}
          icon="angle-right"
          narrow
          variant={variant}
        />
      )}

      <Tooltip content={ZoomOutTooltip} placement="bottom">
        <ToolbarButton aria-label="Zoom out time range" onClick={onZoom} icon="search-minus" variant={variant} />
      </Tooltip>
    </ButtonGroup>
  );
}

const ZoomOutTooltip = () => (
  <>
    Time range zoom out <br /> CTRL+Z
  </>
);

const TimePickerTooltip = ({ timeRange, timeZone }: { timeRange: TimeRange; timeZone?: TimeZone }) => {
  const theme = useTheme();
  const styles = getLabelStyles(theme);

  return (
    <>
      {dateTimeFormat(timeRange.from, { timeZone })}
      <div className="text-center">to</div>
      {dateTimeFormat(timeRange.to, { timeZone })}
      <div className="text-center">
        <span className={styles.utc}>{timeZoneFormatUserFriendly(timeZone)}</span>
      </div>
    </>
  );
};

type LabelProps = Pick<TimeRangePickerProps, 'hideText' | 'value' | 'timeZone'>;

export const TimePickerButtonLabel = memo<LabelProps>(({ hideText, value, timeZone }) => {
  const theme = useTheme();
  const styles = getLabelStyles(theme);

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

/** @public */
export const TimeRangePicker = withTheme(UnthemedTimeRangePicker);

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      position: relative;
      display: flex;
      vertical-align: middle;
    `,
  };
});

const getLabelStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      display: flex;
      align-items: center;
      white-space: nowrap;
    `,
    utc: css`
      color: ${theme.palette.orange};
      font-size: ${theme.typography.size.sm};
      padding-left: 6px;
      line-height: 28px;
      vertical-align: bottom;
      font-weight: ${theme.typography.weight.semibold};
    `,
  };
});
