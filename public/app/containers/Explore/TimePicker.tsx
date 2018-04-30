import React, { PureComponent } from 'react';
import moment from 'moment';

import * as dateMath from 'app/core/utils/datemath';
import * as rangeUtil from 'app/core/utils/rangeutil';

export const DEFAULT_RANGE = {
  from: 'now-6h',
  to: 'now',
};

export default class TimePicker extends PureComponent<any, any> {
  dropdownEl: any;
  constructor(props) {
    super(props);
    this.state = {
      fromRaw: props.range ? props.range.from : DEFAULT_RANGE.from,
      isOpen: false,
      isUtc: false,
      rangeString: rangeUtil.describeTimeRange(props.range || DEFAULT_RANGE),
      refreshInterval: '',
      toRaw: props.range ? props.range.to : DEFAULT_RANGE.to,
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
    to = moment.utc(to);
    from = moment.utc(from);

    this.setState(
      {
        rangeString,
        fromRaw: from,
        toRaw: to,
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
        <form name="timeForm" className="gf-timepicker-absolute-section">
          <h3 className="section-heading">Custom range</h3>

          <label className="small">From:</label>
          <div className="gf-form-inline">
            <div className="gf-form max-width-28">
              <input
                type="text"
                className="gf-form-input input-large"
                value={fromRaw}
                onChange={this.handleChangeFrom}
              />
            </div>
          </div>

          <label className="small">To:</label>
          <div className="gf-form-inline">
            <div className="gf-form max-width-28">
              <input type="text" className="gf-form-input input-large" value={toRaw} onChange={this.handleChangeTo} />
            </div>
          </div>

          {/* <label className="small">Refreshing every:</label>
          <div className="gf-form-inline">
            <div className="gf-form max-width-28">
              <select className="gf-form-input input-medium" ng-options="f.value as f.text for f in ctrl.refresh.options"></select>
            </div>
          </div> */}
        </form>

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
          <button className="btn navbar-button navbar-button--tight" onClick={this.handleClickLeft}>
            <i className="fa fa-chevron-left" />
          </button>
          <button className="btn navbar-button gf-timepicker-nav-btn" onClick={this.handleClickPicker}>
            <i className="fa fa-clock-o" />
            <span> {rangeString}</span>
            {isUtc ? <span className="gf-timepicker-utc">UTC</span> : null}
            {refreshInterval ? <span className="text-warning">&nbsp; Refresh every {refreshInterval}</span> : null}
          </button>
          <button className="btn navbar-button navbar-button--tight" onClick={this.handleClickRight}>
            <i className="fa fa-chevron-right" />
          </button>
        </div>
        {this.renderDropdown()}
      </div>
    );
  }
}
