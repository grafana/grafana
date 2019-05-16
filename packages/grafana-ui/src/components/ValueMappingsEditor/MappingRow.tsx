import React, { ChangeEvent, PureComponent } from 'react';

import { FormField, FormLabel, Input, Select } from '..';

import { MappingType, ValueMapping } from '../../types';

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

  onMappingValueChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ value: event.target.value });
  };

  onMappingFromChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ from: event.target.value });
  };

  onMappingToChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ to: event.target.value });
  };

  onMappingTextChange = (event: ChangeEvent<HTMLInputElement>) => {
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
          <FormField
            label="From"
            labelWidth={4}
            inputWidth={8}
            onBlur={this.updateMapping}
            onChange={this.onMappingFromChange}
            value={from}
          />
          <FormField
            label="To"
            labelWidth={4}
            inputWidth={8}
            onBlur={this.updateMapping}
            onChange={this.onMappingToChange}
            value={to}
          />
          <div className="gf-form gf-form--grow">
            <FormLabel width={4}>Text</FormLabel>
            <Input
              className="gf-form-input"
              onBlur={this.updateMapping}
              value={text}
              onChange={this.onMappingTextChange}
            />
          </div>
        </>
      );
    }

    return (
      <>
        <FormField
          label="Value"
          labelWidth={4}
          onBlur={this.updateMapping}
          onChange={this.onMappingValueChange}
          value={value}
          inputWidth={8}
        />
        <div className="gf-form gf-form--grow">
          <FormLabel width={4}>Text</FormLabel>
          <Input
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
          <FormLabel width={5}>Type</FormLabel>
          <Select
            placeholder="Choose type"
            isSearchable={false}
            options={mappingOptions}
            value={mappingOptions.find(o => o.value === type)}
            // @ts-ignore
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
