import React, { PureComponent } from 'react';
import moment from 'moment';

import * as dateMath from 'app/core/utils/datemath';
import * as rangeUtil from 'app/core/utils/rangeutil';
import { RawTimeRange } from 'app/types/series';

const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';
export const DEFAULT_RANGE = {
  from: 'now-6h',
  to: 'now',
};

/**
 * Return a human-editable string of either relative (inludes "now") or absolute local time (in the shape of DATE_FORMAT).
 * @param value Epoch or relative time
 */
export function parseTime(value: string, isUtc = false): string {
  if (moment.isMoment(value)) {
    return value;
  }
  if (value.indexOf('now') !== -1) {
    return value;
  }
  let time: any = value;
  // Possible epoch
  if (!isNaN(time)) {
    time = parseInt(time, 10);
  }
  time = isUtc ? moment.utc(time) : moment(time);
  return time.format(DATE_FORMAT);
}

interface TimePickerProps {
  isOpen?: boolean;
  isUtc?: boolean;
  range?: RawTimeRange;
  onChangeTime?: (Range) => void;
}

interface TimePickerState {
  isOpen: boolean;
  isUtc: boolean;
  rangeString: string;
  refreshInterval?: string;
  initialRange?: RawTimeRange;

  // Input-controlled text, keep these in a shape that is human-editable
  fromRaw: string;
  toRaw: string;
}

export default class TimePicker extends PureComponent<TimePickerProps, TimePickerState> {
  dropdownEl: any;

  constructor(props) {
    super(props);

    this.state = {
      isOpen: props.isOpen,
      isUtc: props.isUtc,
      rangeString: '',
      fromRaw: '',
      toRaw: '',
      initialRange: DEFAULT_RANGE,
      refreshInterval: '',
    };
  }

  static getDerivedStateFromProps(props, state) {
    if (state.initialRange && state.initialRange === props.range) {
      return state;
    }

    const from = props.range ? props.range.from : DEFAULT_RANGE.from;
    const to = props.range ? props.range.to : DEFAULT_RANGE.to;

    // Ensure internal format
    const fromRaw = parseTime(from, props.isUtc);
    const toRaw = parseTime(to, props.isUtc);
    const range = {
      from: fromRaw,
      to: toRaw,
    };

    return {
      ...state,
      fromRaw,
      toRaw,
      initialRange: props.range,
      rangeString: rangeUtil.describeTimeRange(range),
    };
  }

  move(direction: number) {
    const { onChangeTime } = this.props;
    const { fromRaw, toRaw } = this.state;
    const from = dateMath.parse(fromRaw, false);
    const to = dateMath.parse(toRaw, true);
    const timespan = (to.valueOf() - from.valueOf()) / 2;

    let nextTo, nextFrom;
    if (direction === -1) {
      nextTo = to.valueOf() - timespan;
      nextFrom = from.valueOf() - timespan;
    } else if (direction === 1) {
      nextTo = to.valueOf() + timespan;
      nextFrom = from.valueOf() + timespan;
      if (nextTo > Date.now() && to < Date.now()) {
        nextTo = Date.now();
        nextFrom = from.valueOf();
      }
    } else {
      nextTo = to.valueOf();
      nextFrom = from.valueOf();
    }

    const nextRange = {
      from: moment(nextFrom),
      to: moment(nextTo),
    };

    this.setState(
      {
        rangeString: rangeUtil.describeTimeRange(nextRange),
        fromRaw: nextRange.from.format(DATE_FORMAT),
        toRaw: nextRange.to.format(DATE_FORMAT),
      },
      () => {
        onChangeTime(nextRange);
      }
    );
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
    const { onChangeTime } = this.props;
    let range;
    this.setState(
      state => {
        const { toRaw, fromRaw } = this.state;
        range = {
          from: dateMath.parse(fromRaw, false),
          to: dateMath.parse(toRaw, true),
        };
        const rangeString = rangeUtil.describeTimeRange(range);
        return {
          isOpen: false,
          rangeString,
        };
      },
      () => {
        if (onChangeTime) {
          onChangeTime(range);
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
    this.setState(
      {
        toRaw: range.to,
        fromRaw: range.from,
        isOpen: false,
        rangeString,
      },
      () => {
        if (onChangeTime) {
          onChangeTime(range);
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
        <div className="gf-timepicker-absolute-section">
          <h3 className="section-heading">Custom range</h3>

          <label className="small">From:</label>
          <div className="gf-form-inline">
            <div className="gf-form max-width-28">
              <input
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
              <input
                type="text"
                className="gf-form-input input-large timepicker-to"
                value={toRaw}
                onChange={this.handleChangeTo}
              />
            </div>
          </div>

          {/* <label className="small">Refreshing every:</label>
          <div className="gf-form-inline">
            <div className="gf-form max-width-28">
              <select className="gf-form-input input-medium" ng-options="f.value as f.text for f in ctrl.refresh.options"></select>
            </div>
          </div> */}
          <div className="gf-form">
            <button className="btn gf-form-btn btn-secondary" onClick={this.handleClickApply}>
              Apply
            </button>
          </div>
        </div>

        <div className="gf-timepicker-relative-section">
          <h3 className="section-heading">Quick ranges</h3>
          {Object.keys(timeOptions).map(section => {
            const group = timeOptions[section];
            return (
              <ul key={section}>
                {group.map(option => (
                  <li className={option.active ? 'active' : ''} key={option.display}>
                    <a onClick={() => this.handleClickRelativeOption(option)}>{option.display}</a>
                  </li>
                ))}
              </ul>
            );
          })}
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
