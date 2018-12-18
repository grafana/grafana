import React, { PureComponent } from 'react';
import { Label } from 'app/core/components/Label/Label';
import { Select } from 'app/core/components/Select/Select';
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
          <button onClick={this.props.removeMapping} className="gf-form-label gf-form-label--btn">
            <i className="fa fa-times" />
          </button>
        </div>
      </div>
    );
  }
}
