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

  onSubscribeChanged = (event: React.SyntheticEvent<HTMLInputElement>) => {
    this.props.onOptionsChange({ ...this.props.options, subscribe: event.target.checked });
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
          onChange={this.onSubscribeChanged}
        />
      </PanelOptionsGroup>
    );
  }
}
