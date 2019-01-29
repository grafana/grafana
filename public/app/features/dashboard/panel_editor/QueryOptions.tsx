// Libraries
import React, { PureComponent } from 'react';

// Utils
import { isValidTimeSpan } from 'app/core/utils/rangeutil';

// Components
import { Switch } from '@grafana/ui';
import { Input } from 'app/core/components/Form';
import { EventsWithValidation } from 'app/core/components/Form/Input';
import { InputStatus } from 'app/core/components/Form/Input';
import DataSourceOption from './DataSourceOption';
import { FormLabel } from '@grafana/ui';

// Types
import { PanelModel } from '../panel_model';
import { DataSourceSelectItem } from '@grafana/ui/src/types';
import { ValidationEvents } from 'app/types';

const timeRangeValidationEvents: ValidationEvents = {
  [EventsWithValidation.onBlur]: [
    {
      rule: value => {
        if (!value) {
          return true;
        }
        return isValidTimeSpan(value);
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
}

export class QueryOptions extends PureComponent<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      relativeTime: props.panel.timeFrom || '',
      timeShift: props.panel.timeShift || '',
    };
  }

  onRelativeTimeChange = event => {
    this.setState({
      relativeTime: event.target.value,
    });
  };

  onTimeShiftChange = event => {
    this.setState({
      timeShift: event.target.value,
    });
  };

  onOverrideTime = (evt, status: InputStatus) => {
    const { value } = evt.target;
    const { panel } = this.props;
    const emptyToNullValue = emptyToNull(value);
    if (status === InputStatus.Valid && panel.timeFrom !== emptyToNullValue) {
      panel.timeFrom = emptyToNullValue;
      panel.refresh();
    }
  };

  onTimeShift = (evt, status: InputStatus) => {
    const { value } = evt.target;
    const { panel } = this.props;
    const emptyToNullValue = emptyToNull(value);
    if (status === InputStatus.Valid && panel.timeShift !== emptyToNullValue) {
      panel.timeShift = emptyToNullValue;
      panel.refresh();
    }
  };

  onToggleTimeOverride = () => {
    const { panel } = this.props;
    panel.hideTimeOverride = !panel.hideTimeOverride;
    panel.refresh();
  };

  renderOptions() {
    const { datasource, panel } = this.props;
    const { queryOptions } = datasource.meta;

    if (!queryOptions) {
      return null;
    }

    const onChangeFn = (panelKey: string) => {
      return (value: string | number) => {
        panel[panelKey] = value;
        panel.refresh();
      };
    };

    const allOptions = {
      cacheTimeout: {
        label: 'Cache timeout',
        placeholder: '60',
        name: 'cacheTimeout',
        value: panel.cacheTimeout,
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
        value: panel.maxDataPoints,
        tooltipInfo: (
          <>
            The maximum data points the query should return. For graphs this is automatically set to one data point per
            pixel.
          </>
        ),
      },
      minInterval: {
        label: 'Min time interval',
        placeholder: '0',
        name: 'minInterval',
        value: panel.interval,
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

    return Object.keys(queryOptions).map(key => {
      const options = allOptions[key];
      return <DataSourceOption key={key} {...options} onChange={onChangeFn(allOptions[key].panelKey || key)} />;
    });
  }

  render() {
    const hideTimeOverride = this.props.panel.hideTimeOverride;
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

        <div className="gf-form-inline">
          <Switch label="Hide time info" checked={hideTimeOverride} onChange={this.onToggleTimeOverride} />
        </div>
      </div>
    );
  }
}
