// Libraries
import React, { PureComponent } from 'react';
import { PanelEditorProps, Switch, PanelOptionsGrid, PanelOptionsGroup } from '@grafana/ui';

// Types
import { Options } from './types';

export class LogsPanelEditor extends PureComponent<PanelEditorProps<Options>> {
  onToggleTime = () => {
    const { options, onOptionsChange } = this.props;
    const { showTime } = options;

    onOptionsChange({ ...options, showTime: !showTime });
  };

  render() {
    const { showTime } = this.props.options;

    return (
      <>
        <PanelOptionsGrid>
          <PanelOptionsGroup title="Columns">
            <Switch label="Time" labelClass="width-5" checked={showTime} onChange={this.onToggleTime} />
          </PanelOptionsGroup>
        </PanelOptionsGrid>
      </>
    );
  }
}
