// Libraries
import React, { PureComponent, ChangeEvent } from 'react';

// Components
import { PanelOptionsGroup, Switch, FormField } from '@grafana/ui';
import { PanelEditorProps } from '@grafana/data';

// Types
import { StreamOptions } from './types';

export class StreamPanelEditor extends PureComponent<PanelEditorProps<StreamOptions>> {
  onPathChanged = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onOptionsChange({ ...this.props.options, path: event.target.value });
  };

  onToggleSubscribe = () => {
    const { options } = this.props;
    this.props.onOptionsChange({ ...options, subscribe: !options.subscribe });
  };

  render() {
    const { path, subscribe } = this.props.options;

    return (
      <PanelOptionsGroup title="Stream">
        <FormField
          label="stream"
          labelWidth={6}
          value={path}
          onChange={this.onPathChanged}
          placeholder="${source}/${channel}"
        />
        <Switch
          label="Subscribe"
          labelClass={'width-6'}
          checked={subscribe || false}
          onChange={this.onToggleSubscribe}
        />
      </PanelOptionsGroup>
    );
  }
}
