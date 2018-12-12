import React, { PureComponent } from 'react';
import { Label } from 'app/core/components/Label/Label';
import SimplePicker from 'app/core/components/Picker/SimplePicker';
import { MappingType, RangeMap, ValueMap } from 'app/types';

interface Props {
  mapping: ValueMap | RangeMap;
  updateMapping: (mapping) => void;
  removeMapping: () => void;
}

interface State {
  from: string;
  id: number;
  operator: string;
  text: string;
  to: string;
  type: MappingType;
  value: string;
}

const mappingOptions = [
  { value: MappingType.ValueToText, label: 'Value' },
  { value: MappingType.RangeToText, label: 'Range' },
];

export default class MappingRow extends PureComponent<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      ...props.mapping,
    };
  }

  onMappingValueChange = event => {
    this.setState({ value: event.target.value });
  };

  onMappingFromChange = event => {
    this.setState({ from: event.target.value });
  };

  onMappingToChange = event => {
    this.setState({ to: event.target.value });
  };

  onMappingTextChange = event => {
    this.setState({ text: event.target.value });
  };

  onMappingTypeChange = mappingType => {
    this.setState({ type: mappingType });
  };

  updateMapping = () => {
    this.props.updateMapping({ ...this.state });
  };

  renderRow() {
    const { from, text, to, type, value } = this.state;

    if (type === MappingType.RangeToText) {
      return (
        <div className="gf-form">
          <div className="gf-form-inline mapping-row-input">
            <Label width={4}>From</Label>
            <div>
              <input
                className="gf-form-input"
                value={from}
                onBlur={this.updateMapping}
                onChange={this.onMappingFromChange}
              />
            </div>
          </div>
          <div className="gf-form-inline mapping-row-input">
            <Label width={4}>To</Label>
            <div>
              <input
                className="gf-form-input"
                value={to}
                onBlur={this.updateMapping}
                onChange={this.onMappingToChange}
              />
            </div>
          </div>
          <div className="gf-form-inline mapping-row-input">
            <Label width={4}>Text</Label>
            <div>
              <input
                className="gf-form-input"
                value={text}
                onBlur={this.updateMapping}
                onChange={this.onMappingTextChange}
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="gf-form">
        <div className="gf-form-inline mapping-row-input">
          <Label width={4}>Value</Label>
          <div>
            <input
              className="gf-form-input"
              onBlur={this.updateMapping}
              onChange={this.onMappingValueChange}
              value={value}
            />
          </div>
        </div>
        <div className="gf-form-inline mapping-row-input">
          <Label width={4}>Text</Label>
          <div>
            <input
              className="gf-form-input"
              onBlur={this.updateMapping}
              value={text}
              onChange={this.onMappingTextChange}
            />
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { type } = this.state;

    return (
      <div className="mapping-row">
        <div className="gf-form-inline mapping-row-type">
          <Label width={5}>Type</Label>
          <SimplePicker
            placeholder="Choose type"
            options={mappingOptions}
            value={mappingOptions.find(o => o.value === type)}
            getOptionLabel={i => i.label}
            getOptionValue={i => i.value}
            onSelected={type => this.onMappingTypeChange(type.value)}
            width={7}
          />
        </div>
        <div>{this.renderRow()}</div>
        <div onClick={this.props.removeMapping} className="threshold-row-remove">
          <i className="fa fa-times" />
        </div>
      </div>
    );
  }
}
