import React, { PureComponent } from 'react';
import { Label } from 'app/core/components/Label/Label';
import ToggleButtonGroup, { ToggleButton } from 'app/core/components/ToggleButtonGroup/ToggleButtonGroup';
import { MappingType, RangeMap, ValueMap } from 'app/types';

interface Props {
  mapping: ValueMap | RangeMap;
  updateMapping: (mapping) => void;
  removeMapping: () => void;
}

interface State {
  mapping: ValueMap | RangeMap;
}

export default class MappingRow extends PureComponent<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
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

  onMappingTypeChange = mappingType => {
    const { mapping } = this.state;

    const updatedMapping = { ...mapping, type: mappingType };
    this.setState({ mapping: updatedMapping });
  };

  updateMapping = () => {
    const { mapping } = this.state;

    this.props.updateMapping(mapping);
  };

  renderRow() {
    const { mapping } = this.state;

    if (mapping.type === MappingType.RangeToText) {
      const rangeMap = mapping as RangeMap;

      return (
        <div className="gf-form">
          <div className="gf-form-inline mapping-row-input">
            <Label width={4}>From</Label>
            <div>
              <input
                className="gf-form-input"
                value={rangeMap.from}
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
                value={rangeMap.to}
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
                value={rangeMap.text}
                onBlur={this.updateMapping}
                onChange={this.onMappingTextChange}
              />
            </div>
          </div>
        </div>
      );
    }

    const valueMap = mapping as ValueMap;

    return (
      <div className="gf-form">
        <div className="gf-form-inline mapping-row-input">
          <Label width={4}>Value</Label>
          <div>
            <input
              className="gf-form-input"
              onBlur={this.updateMapping}
              onChange={this.onMappingValueChange}
              value={valueMap.value}
            />
          </div>
        </div>
        <div className="gf-form-inline mapping-row-input">
          <Label width={4}>Text</Label>
          <div>
            <input
              className="gf-form-input"
              onBlur={this.updateMapping}
              value={valueMap.text}
              onChange={this.onMappingTextChange}
            />
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { mapping } = this.state;

    return (
      <div className="mapping-row">
        <div className="mapping-row-type">
          <ToggleButtonGroup
            onChange={mappingType => this.onMappingTypeChange(mappingType)}
            value={mapping.type}
            stackedButtons={true}
            render={({ selectedValue, onChange, stackedButtons }) => {
              return [
                <ToggleButton
                  className="btn-small"
                  key="value"
                  onChange={onChange}
                  selected={selectedValue === MappingType.ValueToText}
                  value={MappingType.ValueToText}
                  stackedButtons={stackedButtons}
                >
                  Value
                </ToggleButton>,
                <ToggleButton
                  className="btn-small"
                  key="range"
                  onChange={onChange}
                  selected={selectedValue === MappingType.RangeToText}
                  value={MappingType.RangeToText}
                  stackedButtons={stackedButtons}
                >
                  Range
                </ToggleButton>,
              ];
            }}
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
