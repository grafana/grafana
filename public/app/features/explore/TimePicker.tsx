import React, { PureComponent } from 'react';
import moment from 'moment';

import * as dateMath from 'app/core/utils/datemath';
import * as rangeUtil from 'app/core/utils/rangeutil';

const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';
export const DEFAULT_RANGE = {
  from: 'now-6h',
  to: 'now',
};

export function parseTime(value, isUtc = false, asString = false) {
  if (value.indexOf('now') !== -1) {
    return value;
  }
  if (!isNaN(value)) {
    const epoch = parseInt(value, 10);
    const m = isUtc ? moment.utc(epoch) : moment(epoch);
    return asString ? m.format(DATE_FORMAT) : m;
  }
  return undefined;
}

export default class TimePicker extends PureComponent<any, any> {
  dropdownEl: any;
  constructor(props) {
    super(props);

    const fromRaw = props.range ? props.range.from : DEFAULT_RANGE.from;
    const toRaw = props.range ? props.range.to : DEFAULT_RANGE.to;
    const range = {
      from: parseTime(fromRaw),
      to: parseTime(toRaw),
    };
    this.state = {
      fromRaw: parseTime(fromRaw, props.isUtc, true),
      isOpen: props.isOpen,
      isUtc: props.isUtc,
      rangeString: rangeUtil.describeTimeRange(range),
      refreshInterval: '',
      toRaw: parseTime(toRaw, props.isUtc, true),
    };
  }

  move(direction) {
    const { onChangeTime } = this.props;
    const { fromRaw, toRaw } = this.state;
    const range = {
      from: dateMath.parse(fromRaw, false),
      to: dateMath.parse(toRaw, true),
    };

    const timespan = (range.to.valueOf() - range.from.valueOf()) / 2;
    let to, from;
    if (direction === -1) {
      to = range.to.valueOf() - timespan;
      from = range.from.valueOf() - timespan;
    } else if (direction === 1) {
      to = range.to.valueOf() + timespan;
      from = range.from.valueOf() + timespan;
      if (to > Date.now() && range.to < Date.now()) {
        to = Date.now();
        from = range.from.valueOf();
      }
    } else {
      to = range.to.valueOf();
      from = range.from.valueOf();
    }

    const rangeString = rangeUtil.describeTimeRange(range);
    // No need to convert to UTC again
    to = moment(to);
    from = moment(from);

    this.setState(
      {
        rangeString,
        fromRaw: from.format(DATE_FORMAT),
        toRaw: to.format(DATE_FORMAT),
      },
      () => {
        onChangeTime({ to, from });
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
    const { toRaw, fromRaw } = this.state;
    const range = {
      from: dateMath.parse(fromRaw, false),
      to: dateMath.parse(toRaw, true),
    };
    const rangeString = rangeUtil.describeTimeRange(range);
    this.setState(
      {
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
