import React, { PureComponent } from 'react';
import { FormGroup, Label, MappingType, RangeMap, Select, ValueMap } from '@grafana/ui';

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
          <FormGroup
            label="From"
            labelWidth={4}
            inputProps={{
              onChange: event => this.onMappingFromChange(event),
              onBlur: () => this.updateMapping(),
              value: from,
            }}
            inputWidth={8}
          />
          <FormGroup
            label="To"
            labelWidth={4}
            inputProps={{
              onBlur: () => this.updateMapping,
              onChange: event => this.onMappingToChange(event),
              value: to,
            }}
            inputWidth={8}
          />
          <FormGroup
            label="Text"
            labelWidth={4}
            inputProps={{
              onBlur: () => this.updateMapping,
              onChange: event => this.onMappingTextChange(event),
              value: text,
            }}
            inputWidth={10}
          />
        </>
      );
    }

    return (
      <>
        <FormGroup
          label="Value"
          labelWidth={4}
          inputProps={{
            onBlur: () => this.updateMapping,
            onChange: event => this.onMappingValueChange(event),
            value: value,
          }}
          inputWidth={8}
        />
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
