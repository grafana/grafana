// Libraries
import React, { PureComponent, ChangeEvent } from 'react';

// Components
import { FormField, FormLabel, PanelOptionsGroup, StatsPicker, StatID } from '@grafana/ui';

// Types
import { FieldDisplayOptions } from './shared';
import { Field } from '../../types/data';
import { FieldPropertiesEditor } from './FieldPropertiesEditor';

const labelWidth = 6;

export interface Props {
  options: FieldDisplayOptions;
  onChange: (valueOptions: FieldDisplayOptions) => void;
  showMinMax: boolean;
  showPrefixSuffix: boolean;
}

export class FieldDisplayEditor extends PureComponent<Props> {
  onStatsChange = (stats: string[]) => {
    this.props.onChange({ ...this.props.options, stats });
  };

  onTitleChange = (event: ChangeEvent<HTMLInputElement>) =>
    this.props.onChange({ ...this.props.options, title: event.target.value });

  onOverrideChange = (value: Partial<Field>) => {
    this.props.onChange({ ...this.props.options, override: value });
  };
  onDefaultsChange = (value: Partial<Field>) => {
    this.props.onChange({ ...this.props.options, defaults: value });
  };

  render() {
    const { showMinMax, showPrefixSuffix, options } = this.props;
    const { title, stats, override } = options;

    return (
      <PanelOptionsGroup title="Value">
        <div className="gf-form">
          <FormLabel width={labelWidth}>Show</FormLabel>
          <StatsPicker
            width={12}
            placeholder="Choose Stat"
            defaultStat={StatID.mean}
            allowMultiple={true}
            stats={stats}
            onChange={this.onStatsChange}
          />
        </div>
        <FormField label="Title" labelWidth={labelWidth} onChange={this.onTitleChange} value={title} />

        <FieldPropertiesEditor
          showMinMax={showMinMax}
          showPrefixSuffix={showPrefixSuffix}
          onChange={this.onOverrideChange}
          options={override}
        />
      </PanelOptionsGroup>
    );
  }
}
