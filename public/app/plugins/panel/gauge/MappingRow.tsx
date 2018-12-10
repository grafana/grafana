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
        <div className="gf-form">
          <div className="gf-form-inline">
            <Label width={4}>From</Label>
            <div>
              <input className="gf-form-input" value={rangeMap.from} onChange={this.onMappingFromChange} />
            </div>
          </div>
          <div className="gf-form-inline">
            <Label width={4}>To</Label>
            <div>
              <input className="gf-form-input" value={rangeMap.to} onChange={this.onMappingToChange} />
            </div>
          </div>
          <div className="gf-form-inline">
            <Label width={4}>Text</Label>
            <div>
              <input className="gf-form-input" value={rangeMap.text} onChange={this.onMappingTextChange} />
            </div>
          </div>
        </div>
      );
    }

    const valueMap = mapping as ValueMap;

    return (
      <div className="gf-form">
        <div className="gf-form-inline">
          <Label width={4}>Value</Label>
          <div>
            <input className="gf-form-input" onChange={this.onMappingValueChange} value={valueMap.value} />
          </div>
        </div>
        <div className="gf-form-inline">
          <Label width={4}>Text</Label>
          <div>
            <input className="gf-form-input" value={valueMap.text} onChange={this.onMappingTextChange} />
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { mappingType } = this.state;

    return (
      <div className="mapping-row">
        <div className="mapping-row-type">
          <ToggleButtonGroup
            onChange={mappingType => this.onMappingTypeChange(mappingType)}
            value={mappingType}
            stackedButtons={true}
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
        </div>
        <div>{this.renderRow()}</div>
      </div>
    );
  }
}
