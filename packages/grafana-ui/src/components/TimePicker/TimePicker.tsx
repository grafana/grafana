// Libraries
import React, { PureComponent, createRef } from 'react';
import { css } from 'emotion';
import classNames from 'classnames';

// Components
import { ButtonSelect } from '../Select/ButtonSelect';
import { Tooltip } from '../Tooltip/Tooltip';
import { TimePickerPopover } from './TimePickerPopover';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';

// Utils & Services
import { isDateTime, DateTime, rangeUtil } from '@grafana/data';
import { rawToTimeRange } from './time';
import { stylesFactory } from '../../themes/stylesFactory';
import { withTheme } from '../../themes/ThemeContext';

// Types
import { TimeRange, TimeOption, TimeZone, SelectableValue, dateMath, GrafanaTheme } from '@grafana/data';
import { Themeable } from '../../types';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    timePickerSynced: css`
      label: timePickerSynced;
      border-color: ${theme.colors.orangeDark};
      background-image: none;
      background-color: transparent;
      color: ${theme.colors.orangeDark};
      &:focus,
      :hover {
        color: ${theme.colors.orangeDark};
        background-image: none;
        background-color: transparent;
      }
    `,
    noRightBorderStyle: css`
      label: noRightBorderStyle;
      border-right: 0;
    `,
  };
});

export interface Props extends Themeable {
  hideText?: boolean;
  value: TimeRange;
  selectOptions: TimeOption[];
  timeZone?: TimeZone;
  timeSyncButton?: JSX.Element;
  isSynced?: boolean;
  onChange: (timeRange: TimeRange) => void;
  onMoveBackward: () => void;
  onMoveForward: () => void;
  onZoom: () => void;
}

export const defaultSelectOptions: TimeOption[] = [
  { from: 'now-1h', to: 'now', display: 'Last 1 hour', section: 3 },
  { from: 'now-6h', to: 'now', display: 'Last 6 hours', section: 3 },
  { from: 'now-24h', to: 'now', display: 'Last 24 hours', section: 3 },
  { from: 'now-7d', to: 'now', display: 'Last 7 days', section: 3 },
  { from: 'now-14d', to: 'now', display: 'Last 14 days', section: 3 },
];

const defaultZoomOutTooltip = () => {
  return (
    <>
      Time range zoom out <br /> CTRL+Z
    </>
  );
};

export interface State {
  isCustomOpen: boolean;
}
class UnThemedTimePicker extends PureComponent<Props, State> {
  pickerTriggerRef = createRef<HTMLDivElement>();

  state: State = {
    isCustomOpen: false,
  };

  mapTimeOptionsToSelectableValues = (selectOptions: TimeOption[]) => {
    const options = selectOptions.map(timeOption => {
      return {
        label: timeOption.display,
        value: timeOption,
      };
    });
    return options;
  };

  onSelectChanged = (item: SelectableValue<TimeOption>) => {
    const { onChange, timeZone } = this.props;

    if (item.value && item.value.from === 'custom') {
      // this is to prevent the ClickOutsideWrapper from directly closing the popover
      setTimeout(() => {
        this.setState({ isCustomOpen: true });
      }, 1);
      return;
    }

    if (item.value) {
      onChange(rawToTimeRange({ from: item.value.from, to: item.value.to }, timeZone));
    }
  };

  onCustomChange = (timeRange: TimeRange) => {
    const { onChange } = this.props;
    onChange(timeRange);
    this.setState({ isCustomOpen: false });
  };

  onCloseCustom = () => {
    this.setState({ isCustomOpen: false });
  };

  render() {
    const {
      selectOptions: selectTimeOptions,
      value,
      onMoveBackward,
      onMoveForward,
      onZoom,
      timeZone,
      timeSyncButton,
      isSynced,
      theme,
      hideText,
    } = this.props;

    const styles = getStyles(theme);
    const { isCustomOpen } = this.state;
    const options = this.mapTimeOptionsToSelectableValues(selectTimeOptions);
    const currentOption = options.find(item => isTimeOptionEqualToTimeRange(item.value, value));

    const isUTC = timeZone === 'utc';

    const adjustedTime = (time: DateTime) => (isUTC ? time.utc() : time.local()) || null;
    const adjustedTimeRange = {
      to: dateMath.isMathString(value.raw.to) ? value.raw.to : adjustedTime(value.to),
      from: dateMath.isMathString(value.raw.from) ? value.raw.from : adjustedTime(value.from),
    };
    const rangeString = rangeUtil.describeTimeRange(adjustedTimeRange);

    const label = !hideText ? (
      <>
        {isCustomOpen && <span>Custom time range</span>}
        {!isCustomOpen && <span>{rangeString}</span>}
        {isUTC && <span className="time-picker-utc">UTC</span>}
      </>
    ) : (
      ''
    );
    const hasAbsolute = isDateTime(value.raw.from) || isDateTime(value.raw.to);

    return (
      <div className="time-picker" ref={this.pickerTriggerRef}>
        <div className="time-picker-buttons">
          {hasAbsolute && (
            <button className="btn navbar-button navbar-button--tight" onClick={onMoveBackward}>
              <i className="fa fa-chevron-left" />
            </button>
          )}
          <ButtonSelect
            className={classNames('time-picker-button-select', {
              ['explore-active-button-glow']: timeSyncButton && isSynced,
              [`btn--radius-right-0 ${styles.noRightBorderStyle}`]: timeSyncButton,
              [styles.timePickerSynced]: timeSyncButton ? isSynced : null,
            })}
            value={currentOption}
            label={label}
            options={options}
            maxMenuHeight={600}
            onChange={this.onSelectChanged}
          />

          {timeSyncButton}

          {hasAbsolute && (
            <button className="btn navbar-button navbar-button--tight" onClick={onMoveForward}>
              <i className="fa fa-chevron-right" />
            </button>
          )}

          <Tooltip content={defaultZoomOutTooltip} placement="bottom">
            <button className="btn navbar-button navbar-button--zoom" onClick={onZoom}>
              <i className="fa fa-search-minus" />
            </button>
          </Tooltip>

          {isCustomOpen && (
            <ClickOutsideWrapper onClick={this.onCloseCustom}>
              <TimePickerPopover value={value} timeZone={timeZone} onChange={this.onCustomChange} />
            </ClickOutsideWrapper>
          )}
        </div>
      </div>
    );
  }
}

function isTimeOptionEqualToTimeRange(option: TimeOption, range: TimeRange): boolean {
  return range.raw.from === option.from && range.raw.to === option.to;
}

export const TimePicker = withTheme(UnThemedTimePicker);
