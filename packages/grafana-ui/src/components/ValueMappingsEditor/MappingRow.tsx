import React, { PureComponent } from 'react';

import { MappingType, ValueMapping } from '../../types/panel';
import { Label } from '../Label/Label';
import { Select } from '../Select/Select';

export interface Props {
  valueMapping: ValueMapping;
  updateValueMapping: (valueMapping: ValueMapping) => void;
  removeValueMapping: () => void;
}

interface State {
  from?: string;
  id: number;
  operator: string;
  text: string;
  to?: string;
  type: MappingType;
  value?: string;
}

const mappingOptions = [
  { value: MappingType.ValueToText, label: 'Value' },
  { value: MappingType.RangeToText, label: 'Range' },
];

export default class MappingRow extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = { ...props.valueMapping };
  }

  onMappingValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ value: event.target.value });
  };

  onMappingFromChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ from: event.target.value });
  };

  onMappingToChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ to: event.target.value });
  };

  onMappingTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ text: event.target.value });
  };

  onMappingTypeChange = (mappingType: MappingType) => {
    this.setState({ type: mappingType });
  };

  updateMapping = () => {
    this.props.updateValueMapping({ ...this.state } as ValueMapping);
  };

  renderRow() {
    const { from, text, to, type, value } = this.state;

    if (type === MappingType.RangeToText) {
      return (
        <>
          <div className="gf-form">
            <Label width={4}>From</Label>
            <input
              className="gf-form-input width-8"
              value={from}
              onBlur={this.updateMapping}
              onChange={this.onMappingFromChange}
            />
          </div>
          <div className="gf-form">
            <Label width={4}>To</Label>
            <input
              className="gf-form-input width-8"
              value={to}
              onBlur={this.updateMapping}
              onChange={this.onMappingToChange}
            />
          </div>
          <div className="gf-form">
            <Label width={4}>Text</Label>
            <input
              className="gf-form-input width-10"
              value={text}
              onBlur={this.updateMapping}
              onChange={this.onMappingTextChange}
            />
          </div>
        </>
      );
    }

    return (
      <>
        <div className="gf-form">
          <Label width={4}>Value</Label>
          <input
            className="gf-form-input width-8"
            onBlur={this.updateMapping}
            onChange={this.onMappingValueChange}
            value={value}
          />
        </div>
        <div className="gf-form gf-form--grow">
          <Label width={4}>Text</Label>
          <input
            className="gf-form-input"
            onBlur={this.updateMapping}
            value={text}
            onChange={this.onMappingTextChange}
          />
        </div>
      </>
    );
  }

  render() {
    const { type } = this.state;

    return (
      <div className="gf-form-inline">
        <div className="gf-form">
          <Label width={5}>Type</Label>
          <Select
            placeholder="Choose type"
            isSearchable={false}
            options={mappingOptions}
            value={mappingOptions.find(o => o.value === type)}
            onChange={type => this.onMappingTypeChange(type.value)}
            width={7}
          />
        </div>
        {this.renderRow()}
        <div className="gf-form">
          <button onClick={this.props.removeValueMapping} className="gf-form-label gf-form-label--btn">
            <i className="fa fa-times" />
          </button>
        </div>
      </div>
    );
  }
}
