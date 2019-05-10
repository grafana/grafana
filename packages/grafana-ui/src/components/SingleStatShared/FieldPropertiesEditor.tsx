// Libraries
import React, { PureComponent, ChangeEvent } from 'react';

// Components
import { FormField } from '../FormField/FormField';
import { FormLabel } from '../FormLabel/FormLabel';
import { UnitPicker } from '../UnitPicker/UnitPicker';

// Types
import { Field } from '../../types/data';
import { toNumberString, toIntegerOrUndefined } from '../../utils';
import { SelectOptionItem } from '../Select/Select';

import { VAR_SERIES_NAME, VAR_FIELD_NAME, VAR_CALC, VAR_CELL_PREFIX } from '../../utils/fieldDisplay';

const labelWidth = 6;

export interface Props {
  showMinMax: boolean;
  value: Partial<Field>;
  onChange: (value: Partial<Field>, event?: React.SyntheticEvent<HTMLElement>) => void;
}

export class FieldPropertiesEditor extends PureComponent<Props> {
  onTitleChange = (event: ChangeEvent<HTMLInputElement>) =>
    this.props.onChange({ ...this.props.value, title: event.target.value });

  // @ts-ignore
  onUnitChange = (unit: SelectOptionItem<string>) => this.props.onChange({ ...this.props.value, unit: unit.value });

  onDecimalChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onChange({
      ...this.props.value,
      decimals: toIntegerOrUndefined(event.target.value),
    });
  };

  onMinChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onChange({
      ...this.props.value,
      min: toIntegerOrUndefined(event.target.value),
    });
  };

  onMaxChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onChange({
      ...this.props.value,
      max: toIntegerOrUndefined(event.target.value),
    });
  };

  render() {
    const { showMinMax } = this.props;
    const { unit, decimals, min, max } = this.props.value;

    const titleTooltip = (
      <div>
        Template Variables:
        <br />
        {'$' + VAR_SERIES_NAME}
        <br />
        {'$' + VAR_FIELD_NAME}
        <br />
        {'$' + VAR_CELL_PREFIX + '{N}'} / {'$' + VAR_CALC}
      </div>
    );

    return (
      <>
        <FormField
          label="Title"
          labelWidth={labelWidth}
          onChange={this.onTitleChange}
          value={this.props.value.title}
          tooltip={titleTooltip}
          placeholder="Auto"
        />

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
    );
  }
}
