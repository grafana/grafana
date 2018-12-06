import React, { PureComponent } from 'react';
import { Label } from 'app/core/components/Label/Label';
import SimplePicker from 'app/core/components/Picker/SimplePicker';
import { OptionModuleProps } from './module';
import { RangeMap, ValueMap } from 'app/types';

interface State {
  valueMaps: ValueMap[];
  rangeMaps: RangeMap[];
}

enum MappingType {
  ValueToText = 1,
  RangeToText = 2,
}

const mappingOptions = [
  { name: 'Value to text', value: MappingType.ValueToText },
  { name: 'Range to text', value: MappingType.RangeToText },
];

export default class ValueMappings extends PureComponent<OptionModuleProps, State> {
  constructor(props) {
    super(props);

    this.state = {
      valueMaps: props.options.valueMaps,
      rangeMaps: props.options.rangeMaps,
    };
  }
  onMappingTypeChange = option => this.props.onChange({ ...this.props.options, mappingType: option.value });

  addValueMap = () =>
    this.setState(prevState => ({
      valueMaps: [...prevState.valueMaps, { op: '', value: '', text: '' }],
    }));

  addRangeMap = () => {
    this.setState = () =>
      this.setState(prevState => ({
        valueMaps: [...prevState.valueMaps, { op: '', value: '', text: '', from: '', to: '' }],
      }));
  };

  updateGauge = () => {};

  renderValueMapList() {
    const { mappingType, rangeMaps, valueMaps } = this.props.options;

    if (mappingType === MappingType.RangeToText) {
      return (
        <div>
          {rangeMaps.length > 0
            ? rangeMaps.map((range, index) => {
                return <div>{`${range.from}-${range.to}`}</div>;
              })
            : 'aint no ranges, add one?'}
        </div>
      );
    }

    return (
      <div>
        {valueMaps.length > 0
          ? valueMaps.map((value, index) => {
              return <div>{`${value}`}</div>;
            })
          : 'aint no values, add one?'}
      </div>
    );
  }

  render() {
    const { mappingType } = this.props.options;

    return (
      <div className="gf-form-group">
        <div className="gf-form">
          <Label width={5}>Type</Label>
          <SimplePicker
            options={mappingOptions}
            defaultValue={MappingType.ValueToText}
            getOptionLabel={i => i.name}
            onSelected={option => this.onMappingTypeChange(option)}
            width={5}
            value={mappingType}
          />
        </div>
        <div className="section gf-form-group">
          <h5 className="page-heading">Set value mappings</h5>
          <div className="gf-form">{this.renderValueMapList()}</div>
        </div>
      </div>
    );
  }
}
