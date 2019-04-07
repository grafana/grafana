// Libraries
import React, { PureComponent } from 'react';

// Components
import { Switch, PanelOptionsGroup } from '@grafana/ui';

// Types
import { SingleStatOptions } from './types';

const labelWidth = 6;

export interface Props {
  options: SingleStatOptions;
  onChange: (options: SingleStatOptions) => void;
}

// colorBackground?: boolean;
// colorValue?: boolean;
// colorPrefix?: boolean;
// colorPostfix?: boolean;

export class ColoringEditor extends PureComponent<Props> {
  onToggleColorBackground = () =>
    this.props.onChange({ ...this.props.options, colorBackground: !this.props.options.colorBackground });

  onToggleColorValue = () => this.props.onChange({ ...this.props.options, colorValue: !this.props.options.colorValue });

  onToggleColorPrefix = () =>
    this.props.onChange({ ...this.props.options, colorPrefix: !this.props.options.colorPrefix });

  onToggleColorPostfix = () =>
    this.props.onChange({ ...this.props.options, colorPostfix: !this.props.options.colorPostfix });

  render() {
    const { colorBackground, colorValue, colorPrefix, colorPostfix } = this.props.options;

    return (
      <PanelOptionsGroup title="Coloring">
        <Switch
          label="Background"
          labelClass={`width-${labelWidth}`}
          checked={colorBackground}
          onChange={this.onToggleColorBackground}
        />

        <Switch
          label="Value"
          labelClass={`width-${labelWidth}`}
          checked={colorValue}
          onChange={this.onToggleColorValue}
        />

        <Switch
          label="Prefix"
          labelClass={`width-${labelWidth}`}
          checked={colorPrefix}
          onChange={this.onToggleColorPrefix}
        />
        <Switch
          label="Postfix"
          labelClass={`width-${labelWidth}`}
          checked={colorPostfix}
          onChange={this.onToggleColorPostfix}
        />
      </PanelOptionsGroup>
    );
  }
}
