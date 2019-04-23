// Libraries
import React, { PureComponent, ChangeEvent } from 'react';

// Components
import { FormField, FormLabel, PanelOptionsGroup, UnitPicker, SelectOptionItem } from '@grafana/ui';

// Types
import { Field } from '../../types/data';
import { toNumberString, toIntegerOrUndefined } from '../../utils';

const labelWidth = 6;

export interface Props {
  title: string;
  options: Partial<Field>;
  onChange: (fieldProperties: Partial<Field>) => void;
  showMinMax: boolean;
}

export class FieldPropertiesEditor extends PureComponent<Props> {
  // @ts-ignore
  onUnitChange = (unit: SelectOptionItem<string>) => this.props.onChange({ ...this.props.value, unit: unit.value });

  onDecimalChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onChange({
      ...this.props.options,
      decimals: toIntegerOrUndefined(event.target.value),
    });
  };

  onMinChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onChange({
      ...this.props.options,
      min: toIntegerOrUndefined(event.target.value),
    });
  };

  onMaxChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onChange({
      ...this.props.options,
      min: toIntegerOrUndefined(event.target.value),
    });
  };

  render() {
    const { showMinMax, title } = this.props;
    const { unit, decimals, min, max } = this.props.options;

    return (
      <PanelOptionsGroup title={title}>
        <>
          <div className="gf-form">
            <FormLabel width={labelWidth}>Unit</FormLabel>
            <UnitPicker defaultValue={unit} onChange={this.onUnitChange} />
          </div>
          {showMinMax && (
            <>
              <FormField
                label="Min"
                labelWidth={labelWidth}
                onChange={this.onMinChange}
                value={toNumberString(min)}
                type="number"
              />
              <FormField
                label="Max"
                labelWidth={labelWidth}
                onChange={this.onMaxChange}
                value={toNumberString(max)}
                type="number"
              />
            </>
          )}
          <FormField
            label="Decimals"
            labelWidth={labelWidth}
            placeholder="auto"
            onChange={this.onDecimalChange}
            value={toNumberString(decimals)}
            type="number"
          />
        </>
      </PanelOptionsGroup>
    );
  }
}
