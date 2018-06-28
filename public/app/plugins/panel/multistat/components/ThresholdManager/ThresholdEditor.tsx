import React from 'react';
// import { FormSwitch } from 'app/core/components/FormSwitch/FormSwitch';
import { ColorPicker } from 'app/core/components/colorpicker/ColorPicker';
import { SimpleSelect } from 'app/core/components/Select/SimpleSelect';

export interface ThresholdModel {
  value: number;
  mode?: ThresholdMode;
  color?: string;
}

export enum ThresholdMode {
  ok = 'ok',
  warning = 'warning',
  critical = 'critical',
  custom = 'custom',
}

interface IProps {
  threshold: ThresholdModel;
  index: number;
  focused?: boolean;
  onChange: (threshold: any, index: number, valueChanged?: boolean) => any;
  onRemove: (index: number) => any;
}

interface IState {
  thresholdValue: string;
}

export class ThresholdEditor extends React.Component<IProps, IState> {
  valueElem: any;

  constructor(props) {
    super(props);

    // thresholdValue should be defined for <input> component to be controlled
    const initialStateValue = props.threshold.value !== null ? props.threshold.value : '';
    this.state = {
      thresholdValue: initialStateValue,
    };
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    // Update state from props before rendering in order to keep it synced
    // https://reactjs.org/docs/react-component.html#static-getderivedstatefromprops
    // https://reactjs.org/docs/react-component.html#unsafe_componentwillupdate
    const newValue = nextProps.threshold.value;
    const newStateValue = newValue !== null ? '' + newValue : '';
    return {
      thresholdValue: newStateValue,
    };
  }

  onThresholdChange(threshold, valueChanged?) {
    this.props.onChange(threshold, this.props.index, valueChanged);
  }

  onInputChange = e => {
    let newValue = toNumberOrNull(e.target.value);
    let newStateValue = newValue !== null ? '' + newValue : '';
    this.setState({ thresholdValue: newStateValue });

    let threshold = this.props.threshold;
    threshold.value = newValue;
    this.onThresholdChange(threshold, true);
  };

  onPropertyChange(propertyName, newValue) {
    let threshold = this.props.threshold;
    threshold[propertyName] = newValue;
    this.onThresholdChange(threshold);
  }

  onRemove = () => {
    this.props.onRemove(this.props.index);
  };

  componentDidUpdate() {
    if (this.props.focused) {
      this.valueElem.focus();
    }
  }

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
            ref={elem => {
              this.valueElem = elem;
            }}
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
              <ColorPicker color={this.props.threshold.color} onChange={this.onPropertyChange.bind(this, 'color')} />
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

function toNumberOrNull(value: string): number {
  if (value === '' || value === null) {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
}
