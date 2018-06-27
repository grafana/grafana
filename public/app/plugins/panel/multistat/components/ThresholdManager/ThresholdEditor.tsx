import React from 'react';
// import { FormSwitch } from 'app/core/components/FormSwitch/FormSwitch';
import { ColorPicker } from 'app/core/components/colorpicker/ColorPicker';
import { SimpleSelect } from 'app/core/components/Select/SimpleSelect';

export interface ThresholdModel {
  value: number | string;
  mode?: ThresholdMode;
  color?: string;
}

export enum ThresholdMode {
  ok = 'ok',
  warning = 'warning',
  critical = 'critical',
  custom = 'custom'
}

export interface IProps {
  threshold: ThresholdModel;
  multipleAxes?: boolean;
  index: number;
  onChange: (threshold: any, index: number) => any;
  onRemove: (index: number) => any;
}

export class ThresholdEditor extends React.Component<IProps, any> {
  constructor(props) {
    super(props);

    // thresholdValue should be defined for <input> component to be controlled
    this.state = {
      thresholdValue: toNumberOrEmptyString(props.threshold.value),
    };
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    // Update state from props before rendering in order to keep it synced
    // https://reactjs.org/docs/react-component.html#static-getderivedstatefromprops
    // https://reactjs.org/docs/react-component.html#unsafe_componentwillupdate
    return {
      thresholdValue: toNumberOrEmptyString(nextProps.threshold.value),
    };
  }

  onThresholdChange(threshold) {
    this.props.onChange(threshold, this.props.index);
  }

  onInputChange = e => {
    let newValue = toNumberOrEmptyString(e.target.value);
    this.setState({ thresholdValue: newValue });

    let threshold = this.props.threshold;
    threshold.value = newValue === '' ? undefined : newValue;
    this.onThresholdChange(threshold);
  };

  onPropertyChange(propertyName, newValue) {
    let threshold = this.props.threshold;
    threshold[propertyName] = newValue;
    this.onThresholdChange(threshold);
  }

  onRemove = () => {
    this.props.onRemove(this.props.index);
  };

  render() {
    const colorModeOptions = ['custom', 'critical', 'warning', 'ok'];

    return (
      <div className="gf-form-inline">
        <div className="gf-form">
          <label className="gf-form-label">T{this.props.index + 1}</label>
        </div>

        <div className="gf-form">
          <input
            type="number"
            className="gf-form-input width-8"
            placeholder="value"
            value={this.state.thresholdValue}
            onChange={this.onInputChange}
          />
        </div>

        <div className="gf-form">
          <label className="gf-form-label">Color Mode</label>
          <div className="gf-form-select-wrapper">
            <SimpleSelect
              className="gf-form-input"
              value={this.props.threshold.mode}
              options={colorModeOptions}
              onChange={this.onPropertyChange.bind(this, 'mode')}
            />
          </div>
        </div>

        {this.props.threshold.mode === ThresholdMode.custom && (
            <div className="gf-form">
              <label className="gf-form-label">Color</label>
              <span className="gf-form-label">
                <ColorPicker
                  color={this.props.threshold.color}
                  onChange={this.onPropertyChange.bind(this, 'color')}
                />
              </span>
            </div>
          )}

        <div className="gf-form">
          <label className="gf-form-label">
            <a className="pointer" onClick={this.onRemove}>
              <i className="fa fa-trash" />
            </a>
          </label>
        </div>
      </div>
    );
  }
}

function toNumberOrEmptyString(value: string): number | string {
  let num = Number(value);
  return isNaN(num) || value === '' ? '' : num;
}
