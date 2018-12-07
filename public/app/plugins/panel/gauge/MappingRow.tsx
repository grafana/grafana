import React, { PureComponent } from 'react';
import { Label } from 'app/core/components/Label/Label';
import ToggleButtonGroup, { ToggleButton } from 'app/core/components/ToggleButtonGroup/ToggleButtonGroup';
import { RangeMap, ValueMap } from 'app/types';

enum MappingType {
  ValueToText = 1,
  RangeToText = 2,
}

interface Props {
  mapping: ValueMap | RangeMap;
  updateMapping: (mapping) => void;
}

interface State {
  mapping: ValueMap | RangeMap;
  mappingType: MappingType;
}

export default class MappingRow extends PureComponent<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      mappingType: MappingType.ValueToText,
      mapping: props.mapping,
    };
  }

  onMappingValueChange = event => {
    const { mapping } = this.state;

    const updatedMapping = { ...mapping, value: event.target.value };

    this.setState({ mapping: updatedMapping });
  };

  onMappingFromChange = event => {
    const { mapping } = this.state;

    const updatedMapping = { ...mapping, from: event.target.value };

    this.setState({ mapping: updatedMapping });
  };

  onMappingToChange = event => {
    const { mapping } = this.state;

    const updatedMapping = { ...mapping, to: event.target.value };

    this.setState({ mapping: updatedMapping });
  };

  onMappingTextChange = event => {
    const { mapping } = this.state;

    const updatedMapping = { ...mapping, text: event.target.value };
    this.setState({ mapping: updatedMapping });
  };

  onMappingTypeChange = mappingType => this.setState({ mappingType });

  renderRow() {
    const { mapping, mappingType } = this.state;

    if (mappingType === MappingType.RangeToText) {
      const rangeMap = mapping as RangeMap;

      return (
        <div className="gf-form-inline">
          <div className="gf-form-group">
            <Label>From</Label>
            <input value={rangeMap.from} onChange={this.onMappingFromChange} />
          </div>
          <div className="gf-form-group">
            <Label>To</Label>
            <input value={rangeMap.to} onChange={this.onMappingToChange} />
          </div>
          <div className="gf-form-group">
            <Label>Text</Label>
            <input value={rangeMap.text} onChange={this.onMappingTextChange} />
          </div>
        </div>
      );
    }

    const valueMap = mapping as ValueMap;

    return (
      <div className="gf-form">
        <div className="gf-form-inline">
          <Label width={4}>Value</Label>
          <input className="gf-form-input" onChange={this.onMappingValueChange} value={valueMap.value} />
        </div>
        <div className="gf-form-inline">
          <Label width={4}>Text</Label>
          <input className="gf-form-input" value={valueMap.text} onChange={this.onMappingTextChange} />
        </div>
      </div>
    );
  }

  render() {
    const { mappingType } = this.state;

    return (
      <div className="gf-form-inline">
        <ToggleButtonGroup
          onChange={mappingType => this.onMappingTypeChange(mappingType)}
          value={mappingType}
          render={({ selectedValue, onChange }) => {
            return [
              <ToggleButton
                className="btn-small"
                key="value"
                onChange={onChange}
                selected={selectedValue === MappingType.ValueToText}
                value={MappingType.ValueToText}
              >
                Value
              </ToggleButton>,
              <ToggleButton
                className="btn-small"
                key="range"
                onChange={onChange}
                selected={selectedValue === MappingType.RangeToText}
                value={MappingType.RangeToText}
              >
                Range
              </ToggleButton>,
            ];
          }}
        />
        <div>{this.renderRow()}</div>
      </div>
    );
  }
}
