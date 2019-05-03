import React, { PureComponent } from 'react';
import moment from 'moment';
import * as rangeUtil from 'app/core/utils/rangeutil';
import { Input, RawTimeRange, TimeRange, TIME_FORMAT } from '@grafana/ui';

interface TimePickerProps {
  isOpen?: boolean;
  isUtc?: boolean;
  range: TimeRange;
  onChangeTime?: (range: RawTimeRange, scanning?: boolean) => void;
}

interface TimePickerState {
  isOpen: boolean;
  isUtc: boolean;
  rangeString: string;
  refreshInterval?: string;
  initialRange: RawTimeRange;

  // Input-controlled text, keep these in a shape that is human-editable
  fromRaw: string;
  toRaw: string;
}

const getRaw = (isUtc: boolean, range: any) => {
  const rawRange = {
    from: range.raw.from,
    to: range.raw.to,
  };

  if (moment.isMoment(rawRange.from)) {
    if (!isUtc) {
      rawRange.from = rawRange.from.local();
    }
    rawRange.from = rawRange.from.format(TIME_FORMAT);
  }

  if (moment.isMoment(rawRange.to)) {
    if (!isUtc) {
      rawRange.to = rawRange.to.local();
    }
    rawRange.to = rawRange.to.format(TIME_FORMAT);
  }

  return rawRange;
};

/**
 * TimePicker with dropdown menu for relative dates.
 *
 * Initialize with a range that is either based on relative rawRange.strings,
 * or on Moment objects.
 * Internally the component needs to keep a string representation in `fromRaw`
 * and `toRaw` for the controlled inputs.
 * When a time is picked, `onChangeTime` is called with the new range that
 * is again based on relative time strings or Moment objects.
 */
export default class TimePicker extends PureComponent<TimePickerProps, TimePickerState> {
  dropdownEl: any;

  constructor(props) {
    super(props);

    const { range, isUtc, isOpen } = props;
    const rawRange = getRaw(props.isUtc, range);

    this.state = {
      isOpen: isOpen,
      isUtc: isUtc,
      rangeString: rangeUtil.describeTimeRange(range.raw),
      fromRaw: rawRange.from,
      toRaw: rawRange.to,
      initialRange: range.raw,
      refreshInterval: '',
    };
  } //Temp solution... How do detect if ds supports table format?

  static getDerivedStateFromProps(props: TimePickerProps, state: TimePickerState) {
    if (
      state.initialRange &&
      state.initialRange.from === props.range.raw.from &&
      state.initialRange.to === props.range.raw.to
    ) {
      return state;
    }

    const { range } = props;
    const rawRange = getRaw(props.isUtc, range);

    return {
      ...state,
      fromRaw: rawRange.from,
      toRaw: rawRange.to,
      initialRange: range.raw,
      rangeString: rangeUtil.describeTimeRange(range.raw),
    };
  }

  move(direction: number, scanning?: boolean): RawTimeRange {
    const { onChangeTime, range: origRange } = this.props;
    const range = {
      from: moment.utc(origRange.from),
      to: moment.utc(origRange.to),
    };
    const timespan = (range.to.valueOf() - range.from.valueOf()) / 2;
    let to, from;
    if (direction === -1) {
      to = range.to.valueOf() - timespan;
      from = range.from.valueOf() - timespan;
    } else if (direction === 1) {
      to = range.to.valueOf() + timespan;
      from = range.from.valueOf() + timespan;
    } else {
      to = range.to.valueOf();
      from = range.from.valueOf();
    }

    const nextTimeRange = {
      from: this.props.isUtc ? moment.utc(from) : moment(from),
      to: this.props.isUtc ? moment.utc(to) : moment(to),
    };
    if (onChangeTime) {
      onChangeTime(nextTimeRange);
    }
    return nextTimeRange;
  }

  handleChangeFrom = e => {
    this.setState({
      fromRaw: e.target.value,
    });
  };

  handleChangeTo = e => {
    this.setState({
      toRaw: e.target.value,
    });
  };

  handleClickApply = () => {
    const { onChangeTime, isUtc } = this.props;
    let rawRange;
    this.setState(
      state => {
        const { toRaw, fromRaw } = this.state;
        rawRange = {
          from: fromRaw,
          to: toRaw,
        };

        if (rawRange.from.indexOf('now') === -1) {
          rawRange.from = isUtc ? moment.utc(rawRange.from, TIME_FORMAT) : moment(rawRange.from, TIME_FORMAT);
        }

        if (rawRange.to.indexOf('now') === -1) {
          rawRange.to = isUtc ? moment.utc(rawRange.to, TIME_FORMAT) : moment(rawRange.to, TIME_FORMAT);
        }

        const rangeString = rangeUtil.describeTimeRange(rawRange);
        return {
          isOpen: false,
          rangeString,
        };
      },
      () => {
        if (onChangeTime) {
          onChangeTime(rawRange);
        }
      }
    );
  };

  handleClickLeft = () => this.move(-1);
  handleClickPicker = () => {
    this.setState(state => ({
      isOpen: !state.isOpen,
    }));
  };
  handleClickRight = () => this.move(1);
  handleClickRefresh = () => {};
  handleClickRelativeOption = range => {
    const { onChangeTime } = this.props;
    const rangeString = rangeUtil.describeTimeRange(range);
    const rawRange = {
      from: range.from,
      to: range.to,
    };
    this.setState(
      {
        toRaw: rawRange.to,
        fromRaw: rawRange.from,
        isOpen: false,
        rangeString,
      },
      () => {
        if (onChangeTime) {
          onChangeTime(rawRange);
        }
      }
    );
  };

  getTimeOptions() {
    return rangeUtil.getRelativeTimesList({}, this.state.rangeString);
  }

  dropdownRef = el => {
    this.dropdownEl = el;
  };

  renderDropdown() {
    const { fromRaw, isOpen, toRaw } = this.state;
    if (!isOpen) {
      return null;
    }
    const timeOptions = this.getTimeOptions();
    return (
      <div ref={this.dropdownRef} className="gf-timepicker-dropdown">
        <div className="popover-box">
          <div className="popover-box__header">
            <span className="popover-box__title">Quick ranges</span>
          </div>
          <div className="popover-box__body gf-timepicker-relative-section">
            {Object.keys(timeOptions).map(section => {
              const group = timeOptions[section];
              return (
                <ul key={section}>
                  {group.map((option: any) => (
                    <li className={option.active ? 'active' : ''} key={option.display}>
                      <a onClick={() => this.handleClickRelativeOption(option)}>{option.display}</a>
                    </li>
                  ))}
                </ul>
              );
            })}
          </div>
        </div>

        <div className="popover-box">
          <div className="popover-box__header">
            <span className="popover-box__title">Custom range</span>
          </div>
          <div className="popover-box__body gf-timepicker-absolute-section">
            <label className="small">From:</label>
            <div className="gf-form-inline">
              <div className="gf-form max-width-28">
                <Input
                  type="text"
                  className="gf-form-input input-large timepicker-from"
                  value={fromRaw}
                  onChange={this.handleChangeFrom}
                />
              </div>
            </div>

            <label className="small">To:</label>
            <div className="gf-form-inline">
              <div className="gf-form max-width-28">
                <Input
                  type="text"
                  className="gf-form-input input-large timepicker-to"
                  value={toRaw}
                  onChange={this.handleChangeTo}
                />
              </div>
            </div>
            <div className="gf-form">
              <button className="btn gf-form-btn btn-secondary" onClick={this.handleClickApply}>
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { isUtc, rangeString, refreshInterval } = this.state;

    return (
      <div className="timepicker">
        <div className="navbar-buttons">
          <button className="btn navbar-button navbar-button--tight timepicker-left" onClick={this.handleClickLeft}>
            <i className="fa fa-chevron-left" />
          </button>
          <button className="btn navbar-button gf-timepicker-nav-btn" onClick={this.handleClickPicker}>
            <i className="fa fa-clock-o" />
            <span className="timepicker-rangestring">{rangeString}</span>
            {isUtc ? <span className="gf-timepicker-utc">UTC</span> : null}
            {refreshInterval ? <span className="text-warning">&nbsp; Refresh every {refreshInterval}</span> : null}
          </button>
          <button className="btn navbar-button navbar-button--tight timepicker-right" onClick={this.handleClickRight}>
            <i className="fa fa-chevron-right" />
          </button>
        </div>
        {this.renderDropdown()}
      </div>
    );
  }
}
