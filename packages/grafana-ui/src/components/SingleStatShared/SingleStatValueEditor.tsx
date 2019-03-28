// Libraries
import React, { PureComponent, ChangeEvent } from 'react';

// Components
import {
  FormField,
  FormLabel,
  PanelOptionsGroup,
  StatsPicker,
  UnitPicker,
  StatID,
  SelectOptionItem,
} from '@grafana/ui';

// Types
import { SingleStatValueOptions } from './shared';

const labelWidth = 6;

export interface Props {
  options: SingleStatValueOptions;
  onChange: (valueOptions: SingleStatValueOptions) => void;
}

export class SingleStatValueEditor extends PureComponent<Props> {
  onUnitChange = (unit: SelectOptionItem) => this.props.onChange({ ...this.props.options, unit: unit.value });

  onStatsChange = (stats: string[]) => {
    const stat = stats[0] || StatID.mean;
    this.props.onChange({ ...this.props.options, stat });
  };

  onDecimalChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!isNaN(parseInt(event.target.value, 10))) {
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

  onPrefixChange = (event: ChangeEvent<HTMLInputElement>) =>
    this.props.onChange({ ...this.props.options, prefix: event.target.value });
  onSuffixChange = (event: ChangeEvent<HTMLInputElement>) =>
    this.props.onChange({ ...this.props.options, suffix: event.target.value });

  render() {
    const { stat, unit, decimals, prefix, suffix } = this.props.options;

    let decimalsString = '';
    if (decimals !== null && decimals !== undefined && Number.isFinite(decimals as number)) {
      decimalsString = decimals.toString();
    }

    return (
      <PanelOptionsGroup title="Value">
        <div className="gf-form">
          <FormLabel width={labelWidth}>Show</FormLabel>
          <StatsPicker
            width={12}
            placeholder="Choose Stat"
            defaultStat={StatID.mean}
            allowMultiple={false}
            stats={[stat]}
            onChange={this.onStatsChange}
          />
        </div>
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
