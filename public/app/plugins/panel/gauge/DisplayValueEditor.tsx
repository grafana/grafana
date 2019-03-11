// Libraries
import React, { PureComponent } from 'react';

// Components
import { FormField, FormLabel, PanelOptionsGroup, UnitPicker } from '@grafana/ui';

// Types
import { DisplayValueOptions } from '@grafana/ui/src/utils/valueProcessor';

const labelWidth = 6;

export interface Props {
  options: DisplayValueOptions;
  onChange: (options: DisplayValueOptions) => void;
}

export class DisplayValueEditor extends PureComponent<Props> {
  onUnitChange = unit => this.props.onChange({ ...this.props.options, unit: unit.value });

  onDecimalChange = event => {
    if (!isNaN(event.target.value)) {
      this.props.onChange({
        ...this.props.options,
        decimals: parseInt(event.target.value, 10),
      });
    } else {
      this.props.onChange({
        ...this.props.options,
        decimals: null,
      });
    }
  };

  onPrefixChange = event => this.props.onChange({ ...this.props.options, prefix: event.target.value });
  onSuffixChange = event => this.props.onChange({ ...this.props.options, suffix: event.target.value });

  render() {
    const { unit, decimals, prefix, suffix } = this.props.options;

    let decimalsString = '';
    if (Number.isFinite(decimals)) {
      decimalsString = decimals.toString();
    }

    return (
      <PanelOptionsGroup title="Display Value">
        <div className="gf-form">
          <FormLabel width={labelWidth}>Unit</FormLabel>
          <UnitPicker defaultValue={unit} onChange={this.onUnitChange} />
        </div>
        <FormField
          label="Decimals"
          labelWidth={labelWidth}
          placeholder="auto"
          onChange={this.onDecimalChange}
          value={decimalsString}
          type="number"
        />
        <FormField label="Prefix" labelWidth={labelWidth} onChange={this.onPrefixChange} value={prefix || ''} />
        <FormField label="Suffix" labelWidth={labelWidth} onChange={this.onSuffixChange} value={suffix || ''} />
      </PanelOptionsGroup>
    );
  }
}
