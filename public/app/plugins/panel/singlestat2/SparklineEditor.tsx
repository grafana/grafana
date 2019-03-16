// Libraries
import React, { PureComponent } from 'react';

// Components
import { Switch, PanelOptionsGroup } from '@grafana/ui';

// Types
import { SparklineOptions } from './types';

const labelWidth = 6;

export interface Props {
  options: SparklineOptions;
  onChange: (options: SparklineOptions) => void;
}

export class SparklineEditor extends PureComponent<Props> {
  onToggleShow = () => this.props.onChange({ ...this.props.options, show: !this.props.options.show });

  onToggleFull = () => this.props.onChange({ ...this.props.options, full: !this.props.options.full });

  render() {
    const { show, full } = this.props.options;

    return (
      <PanelOptionsGroup title="Sparkline">
        <Switch label="Show" labelClass={`width-${labelWidth}`} checked={show} onChange={this.onToggleShow} />

        <Switch label="Full Height" labelClass={`width-${labelWidth}`} checked={full} onChange={this.onToggleFull} />
      </PanelOptionsGroup>
    );
  }
}
