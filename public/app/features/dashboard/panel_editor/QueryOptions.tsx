// Libraries
import React, { PureComponent, ChangeEvent, FocusEvent, ReactText } from 'react';

// Utils
import { rangeUtil, DataSourceSelectItem } from '@grafana/data';

// Components
import { EventsWithValidation, Input, InputStatus, Switch, ValidationEvents, FormLabel } from '@grafana/ui';
import { DataSourceOption } from './DataSourceOption';

// Types
import { PanelModel } from '../state';

const timeRangeValidationEvents: ValidationEvents = {
  [EventsWithValidation.onBlur]: [
    {
      rule: value => {
        if (!value) {
          return true;
        }
        return rangeUtil.isValidTimeSpan(value);
      },
      errorMessage: 'Not a valid timespan',
    },
  ],
};

const emptyToNull = (value: string) => {
  return value === '' ? null : value;
};

interface Props {
  panel: PanelModel;
  datasource: DataSourceSelectItem;
}

interface State {
  relativeTime: string;
  timeShift: string;
  cacheTimeout: string;
  maxDataPoints: string | ReactText;
  interval: string;
  hideTimeOverride: boolean;
}

export class QueryOptions extends PureComponent<Props, State> {
  allOptions: any = {
    cacheTimeout: {
      label: 'Cache timeout',
      placeholder: '60',
      name: 'cacheTimeout',
      tooltipInfo: (
        <>
          If your time series store has a query cache this option can override the default cache timeout. Specify a
          numeric value in seconds.
        </>
      ),
    },
    maxDataPoints: {
      label: 'Max data points',
      placeholder: 'auto',
      name: 'maxDataPoints',
      tooltipInfo: (
        <>
          The maximum data points the query should return. For graphs this is automatically set to one data point per
          pixel. For some data sources this can also be capped in the datasource settings page. With streaming data,
          this value is used for the rolling buffer.
        </>
      ),
    },
    minInterval: {
      label: 'Min time interval',
      placeholder: '0',
      name: 'minInterval',
      panelKey: 'interval',
      tooltipInfo: (
        <>
          A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example{' '}
          <code>1m</code> if your data is written every minute. Access auto interval via variable{' '}
          <code>$__interval</code> for time range string and <code>$__interval_ms</code> for numeric variable that can
          be used in math expressions.
        </>
      ),
    },
  };

  constructor(props: Props) {
    super(props);

    this.state = {
      relativeTime: props.panel.timeFrom || '',
      timeShift: props.panel.timeShift || '',
      cacheTimeout: props.panel.cacheTimeout || '',
      maxDataPoints: props.panel.maxDataPoints || '',
      interval: props.panel.interval || '',
      hideTimeOverride: props.panel.hideTimeOverride || false,
    };
  }

  onRelativeTimeChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({
      relativeTime: event.target.value,
    });
  };

  onTimeShiftChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({
      timeShift: event.target.value,
    });
  };

  onOverrideTime = (event: FocusEvent<HTMLInputElement>, status: InputStatus) => {
    const { value } = event.target;
    const { panel } = this.props;
    const emptyToNullValue = emptyToNull(value);
    if (status === InputStatus.Valid && panel.timeFrom !== emptyToNullValue) {
      panel.timeFrom = emptyToNullValue;
      panel.refresh();
    }
  };

  onTimeShift = (event: FocusEvent<HTMLInputElement>, status: InputStatus) => {
    const { value } = event.target;
    const { panel } = this.props;
    const emptyToNullValue = emptyToNull(value);
    if (status === InputStatus.Valid && panel.timeShift !== emptyToNullValue) {
      panel.timeShift = emptyToNullValue;
      panel.refresh();
    }
  };

  onToggleTimeOverride = () => {
    const { panel } = this.props;
    this.setState({ hideTimeOverride: !this.state.hideTimeOverride }, () => {
      panel.hideTimeOverride = this.state.hideTimeOverride;
      panel.refresh();
    });
  };

  onDataSourceOptionBlur = (panelKey: string) => () => {
    const { panel } = this.props;

    // @ts-ignore
    panel[panelKey] = this.state[panelKey];
    panel.refresh();
  };

  onDataSourceOptionChange = (panelKey: string) => (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ ...this.state, [panelKey]: event.target.value });
  };

  /**
   * Show options for any value that is set, or values that the
   * current datasource says it will use
   */
  renderOptions = () => {
    const { datasource } = this.props;
    const queryOptions: any = datasource.meta.queryOptions || {};

    return Object.keys(this.allOptions).map(key => {
      const options = this.allOptions[key];
      const panelKey = options.panelKey || key;

      // @ts-ignore
      const value = this.state[panelKey];

      if (queryOptions[key]) {
        return (
          <DataSourceOption
            key={key}
            {...options}
            onChange={this.onDataSourceOptionChange(panelKey)}
            onBlur={this.onDataSourceOptionBlur(panelKey)}
            value={value}
          />
        );
      }
      return null; // nothing to render
    });
  };

  render() {
    const { hideTimeOverride } = this.state;
    const { relativeTime, timeShift } = this.state;
    return (
      <div className="gf-form-inline">
        {this.renderOptions()}

        <div className="gf-form">
          <FormLabel>Relative time</FormLabel>
          <Input
            type="text"
            className="width-6"
            placeholder="1h"
            onChange={this.onRelativeTimeChange}
            onBlur={this.onOverrideTime}
            validationEvents={timeRangeValidationEvents}
            hideErrorMessage={true}
            value={relativeTime}
          />
        </div>

        <div className="gf-form">
          <span className="gf-form-label">Time shift</span>
          <Input
            type="text"
            className="width-6"
            placeholder="1h"
            onChange={this.onTimeShiftChange}
            onBlur={this.onTimeShift}
            validationEvents={timeRangeValidationEvents}
            hideErrorMessage={true}
            value={timeShift}
          />
        </div>
        {(timeShift || relativeTime) && (
          <div className="gf-form-inline">
            <Switch label="Hide time info" checked={hideTimeOverride} onChange={this.onToggleTimeOverride} />
          </div>
        )}
      </div>
    );
  }
}
