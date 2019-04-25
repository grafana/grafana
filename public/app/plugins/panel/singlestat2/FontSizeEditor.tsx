// Libraries
import React, { PureComponent } from 'react';

// Components
import { FormLabel, Select, PanelOptionsGroup, SelectOptionItem } from '@grafana/ui';

// Types
import { SingleStatOptions } from './types';

const labelWidth = 6;

export interface Props {
  options: SingleStatOptions;
  onChange: (options: SingleStatOptions) => void;
}

const percents = ['20%', '30%', '50%', '70%', '80%', '100%', '110%', '120%', '150%', '170%', '200%'];
const fontSizeOptions = percents.map(v => {
  return { value: v, label: v };
});

export class FontSizeEditor extends PureComponent<Props> {
  setPrefixFontSize = (v: SelectOptionItem<string>) =>
    this.props.onChange({ ...this.props.options, prefixFontSize: v.value });

  setValueFontSize = (v: SelectOptionItem<string>) =>
    this.props.onChange({ ...this.props.options, valueFontSize: v.value });

  setPostfixFontSize = (v: SelectOptionItem<string>) =>
    this.props.onChange({ ...this.props.options, postfixFontSize: v.value });

  render() {
    const { prefixFontSize, valueFontSize, postfixFontSize } = this.props.options;

    return (
      <PanelOptionsGroup title="Font Size">
        <div className="gf-form">
          <FormLabel width={labelWidth}>Prefix</FormLabel>
          <Select
            width={12}
            options={fontSizeOptions}
            onChange={this.setPrefixFontSize}
            value={fontSizeOptions.find(option => option.value === prefixFontSize)}
          />
        </div>

        <div className="gf-form">
          <FormLabel width={labelWidth}>Value</FormLabel>
          <Select
            width={12}
            options={fontSizeOptions}
            onChange={this.setValueFontSize}
            value={fontSizeOptions.find(option => option.value === valueFontSize)}
          />
        </div>

        <div className="gf-form">
          <FormLabel width={labelWidth}>Postfix</FormLabel>
          <Select
            width={12}
            options={fontSizeOptions}
            onChange={this.setPostfixFontSize}
            value={fontSizeOptions.find(option => option.value === postfixFontSize)}
          />
        </div>
      </PanelOptionsGroup>
    );
  }
}
