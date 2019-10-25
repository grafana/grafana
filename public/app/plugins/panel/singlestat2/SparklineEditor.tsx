// Libraries
import React, { PureComponent } from 'react';

// Components
import { Switch } from '@grafana/ui';

// Types
import { SparklineOptions } from './types';

interface Props {
  options: SparklineOptions;
  onChange: (options: SparklineOptions) => void;
}

export class SparklineEditor extends PureComponent<Props> {
  onToggleShow = () => this.props.onChange({ ...this.props.options, show: !this.props.options.show });

  render() {
    const { show } = this.props.options;

    return <Switch label="Graph" labelClass="width-8" checked={show} onChange={this.onToggleShow} />;
  }
}
