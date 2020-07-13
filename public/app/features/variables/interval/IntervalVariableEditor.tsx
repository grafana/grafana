import React, { ChangeEvent, FocusEvent, PureComponent } from 'react';

import { IntervalVariableModel } from '../types';
import { VariableEditorProps } from '../editor/types';
import { InlineFormLabel, LegacyForms } from '@grafana/ui';

const { Switch } = LegacyForms;

export interface Props extends VariableEditorProps<IntervalVariableModel> {}

export class IntervalVariableEditor extends PureComponent<Props> {
  onAutoChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'auto',
      propValue: event.target.checked,
      updateOptions: true,
    });
  };

  onQueryChanged = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'query',
      propValue: event.target.value,
    });
  };

  onQueryBlur = (event: FocusEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'query',
      propValue: event.target.value,
      updateOptions: true,
    });
  };

  onAutoCountChanged = (event: ChangeEvent<HTMLSelectElement>) => {
    this.props.onPropChange({
      propName: 'auto_count',
      propValue: event.target.value,
      updateOptions: true,
    });
  };

  onAutoMinChanged = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'auto_min',
      propValue: event.target.value,
      updateOptions: true,
    });
  };

  render() {
    return (
      <>
        <div className="gf-form-group">
          <h5 className="section-heading">Interval Options</h5>

          <div className="gf-form">
            <span className="gf-form-label width-9">Values</span>
            <input
              type="text"
              className="gf-form-input"
              value={this.props.variable.query}
              placeholder="1m,10m,1h,6h,1d,7d"
              onChange={this.onQueryChanged}
              onBlur={this.onQueryBlur}
              required
            />
          </div>

          <div className="gf-form-inline">
            <Switch
              label="Auto Option"
              labelClass="width-9"
              checked={this.props.variable.auto}
              onChange={this.onAutoChange}
              tooltip={'Enables multiple values to be selected at the same time'}
            />

            {this.props.variable.auto && (
              <>
                <div className="gf-form">
                  <InlineFormLabel
                    width={9}
                    tooltip={'How many times should the current time range be divided to calculate the value'}
                  >
                    Step count
                  </InlineFormLabel>
                  <div className="gf-form-select-wrapper max-width-10">
                    <select
                      className="gf-form-input"
                      value={this.props.variable.auto_count}
                      onChange={this.onAutoCountChanged}
                    >
                      {[1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 100, 200, 300, 400, 500].map(count => (
                        <option key={`auto_count_key-${count}`} label={`${count}`}>
                          {count}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="gf-form">
                  <InlineFormLabel width={9} tooltip={'The calculated value will not go below this threshold'}>
                    Min interval
                  </InlineFormLabel>
                  <input
                    type="text"
                    className="gf-form-input max-width-10"
                    value={this.props.variable.auto_min}
                    onChange={this.onAutoMinChanged}
                    placeholder="10s"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </>
    );
  }
}
