import React, { PureComponent } from 'react';
import { Switch } from 'app/core/components/Switch/Switch';
import { Input } from 'app/core/components/Form';
import { isValidTimeSpan } from 'app/core/utils/rangeutil';
import { ValidationEvents } from 'app/types';
import { EventsWithValidation } from 'app/core/components/Form/Input';
import { PanelModel } from '../panel_model';
import { InputStatus } from 'app/core/components/Form/Input';

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
}

export class TimeRangeOptions extends PureComponent<Props> {
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

  render = () => {
    const hideTimeOverride = this.props.panel.hideTimeOverride;
    return (
      <>
        <h5 className="section-heading">Time Range</h5>

        <div className="gf-form-group">
          <div className="gf-form">
            <span className="gf-form-label width-12">Override relative time</span>
            <Input
              type="text"
              className="gf-form-input max-width-8"
              placeholder="1h"
              onBlur={this.onOverrideTime}
              validationEvents={timeRangeValidationEvents}
              hideErrorMessage={true}
            />
          </div>

          <div className="gf-form">
            <span className="gf-form-label width-12">Add time shift</span>
            <Input
              type="text"
              className="gf-form-input max-width-8"
              placeholder="1h"
              onBlur={this.onTimeShift}
              validationEvents={timeRangeValidationEvents}
              hideErrorMessage={true}
            />
          </div>

          <div className="gf-form-inline">
            <Switch label="Hide time override info" checked={hideTimeOverride} onChange={this.onToggleTimeOverride} />
          </div>
        </div>
      </>
    );
  };
}
