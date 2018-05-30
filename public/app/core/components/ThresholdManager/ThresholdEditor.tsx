import React from 'react';
import { FormSwitch } from '../FormSwitch/FormSwitch';
import { ColorPicker } from '../colorpicker/ColorPicker';
import { SimpleSelect } from '../Select/SimpleSelect';

export interface IProps {
  threshold: any;
  multipleAxes?: boolean;
  index: number;
  onChange: (threshold: any, index: number) => any;
  onRemove: (index: number) => any;
}

export class ThresholdEditor extends React.Component<IProps, any> {
  constructor(props) {
    super(props);

    // thresholdValue should be defined for <input> component to be controlled
    this.state = { thresholdValue: props.threshold.value || 0 };
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    // Update state from props before rendering in order to keep it synced
    // https://reactjs.org/docs/react-component.html#static-getderivedstatefromprops
    // https://reactjs.org/docs/react-component.html#unsafe_componentwillupdate
    return { thresholdValue: nextProps.threshold.value || 0 };
  }

  onThresholdChange(threshold) {
    this.props.onChange(threshold, this.props.index);
  }

  onInputChange = e => {
    const newValue = e.target.value;
    this.setState({ thresholdValue: newValue });

    let threshold = this.props.threshold;
    threshold.value = newValue;
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
    const operatorOptions = ['gt', 'lt'];
    const colorOptions = ['custom', 'critical', 'warning', 'ok'];
    const yAxisOptions = ['left', 'right'];

    return (
      <div className="gf-form-inline">
        <div className="gf-form">
          <label className="gf-form-label">T{this.props.index + 1}</label>
        </div>

        <div className="gf-form">
          <div className="gf-form-select-wrapper">
            <SimpleSelect
              className="gf-form-input"
              value={this.props.threshold.op}
              options={operatorOptions}
              onChange={this.onPropertyChange.bind(this, 'op')}
            />
          </div>
          <input
            type="number"
            className="gf-form-input width-8"
            placeholder="value"
            value={this.state.thresholdValue}
            onChange={this.onInputChange}
          />
        </div>

        <div className="gf-form">
          <label className="gf-form-label">Color</label>
          <div className="gf-form-select-wrapper">
            <SimpleSelect
              className="gf-form-input"
              value={this.props.threshold.colorMode}
              options={colorOptions}
              onChange={this.onPropertyChange.bind(this, 'colorMode')}
            />
          </div>
        </div>

        <FormSwitch
          switchClass="gf-form"
          label="Fill"
          checked={this.props.threshold.fill}
          onChange={this.onPropertyChange.bind(this, 'fill')}
        />

        {this.props.threshold.fill &&
          this.props.threshold.colorMode === 'custom' && (
            <div className="gf-form">
              <label className="gf-form-label">Fill color</label>
              <span className="gf-form-label">
                <ColorPicker
                  color={this.props.threshold.fillColor}
                  onChange={this.onPropertyChange.bind(this, 'fillColor')}
                />
              </span>
            </div>
          )}

        <FormSwitch
          switchClass="gf-form"
          label="Line"
          checked={this.props.threshold.line}
          onChange={this.onPropertyChange.bind(this, 'line')}
        />

        {this.props.threshold.line &&
          this.props.threshold.colorMode === 'custom' && (
            <div className="gf-form">
              <label className="gf-form-label">Line color</label>
              <span className="gf-form-label">
                <ColorPicker
                  color={this.props.threshold.lineColor}
                  onChange={this.onPropertyChange.bind(this, 'lineColor')}
                />
              </span>
            </div>
          )}

        {this.props.multipleAxes && (
          <div className="gf-form">
            <label className="gf-form-label">Y-Axis</label>
            <div className="gf-form-select-wrapper">
              <SimpleSelect
                className="gf-form-input"
                value={this.props.threshold.yaxis}
                options={yAxisOptions}
                onChange={this.onPropertyChange.bind(this, 'yaxis')}
              />
            </div>
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
