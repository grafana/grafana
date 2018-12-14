// Libraries
import React, { PureComponent } from 'react';

// Utils
import { isValidTimeSpan } from 'app/core/utils/rangeutil';

// Components
import { Switch } from 'app/core/components/Switch/Switch';
import { Input } from 'app/core/components/Form';
import { EventsWithValidation } from 'app/core/components/Form/Input';
import { InputStatus } from 'app/core/components/Form/Input';
import DataSourceOption from './DataSourceOption';

// Types
import { PanelModel } from '../panel_model';
import { ValidationEvents, DataSourceSelectItem } from 'app/types';

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

export class QueryOptions extends PureComponent<Props> {
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

  render = () => {
    const hideTimeOverride = this.props.panel.hideTimeOverride;
    return (
      <div className="gf-form-inline">
        {this.renderOptions()}

        <div className="gf-form">
          <span className="gf-form-label">Relative time</span>
          <Input
            type="text"
            className="width-6"
            placeholder="1h"
            onBlur={this.onOverrideTime}
            validationEvents={timeRangeValidationEvents}
            hideErrorMessage={true}
          />
        </div>

        <div className="gf-form">
          <span className="gf-form-label">Time shift</span>
          <Input
            type="text"
            className="width-6"
            placeholder="1h"
            onBlur={this.onTimeShift}
            validationEvents={timeRangeValidationEvents}
            hideErrorMessage={true}
          />
        </div>

        <div className="gf-form-inline">
          <Switch label="Hide time info" checked={hideTimeOverride} onChange={this.onToggleTimeOverride} />
        </div>
      </div>
    );
  };
}
