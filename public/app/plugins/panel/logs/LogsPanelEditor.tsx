// Libraries
import React, { PureComponent } from 'react';
import _ from 'lodash';
import { PanelEditorProps, Switch, PanelOptionsGrid, PanelOptionsGroup } from '@grafana/ui';
import { LogsDedupStrategy } from '@grafana/data';

// Types
import { Options } from './types';
import { LogsDedupDescription } from 'app/core/logs_model';
import ToggleButtonGroup, { ToggleButton } from 'app/core/components/ToggleButtonGroup/ToggleButtonGroup';

export class LogsPanelEditor extends PureComponent<PanelEditorProps<Options>> {
  onToggleTime = () => {
    const { options, onOptionsChange } = this.props;
    const { showTime } = options;

    onOptionsChange({ ...options, showTime: !showTime });
  };

  onToggleLabels = () => {
    const { options, onOptionsChange } = this.props;
    const { showLabels } = options;

    onOptionsChange({ ...options, showLabels: !showLabels });
  };

  onChangeDedup = (dedup: LogsDedupStrategy) => {
    const { options, onOptionsChange } = this.props;

    onOptionsChange({ ...options, dedupStrategy: dedup });
  };

  render() {
    const { showTime, showLabels, dedupStrategy } = this.props.options;

    return (
      <>
        <PanelOptionsGrid>
          <PanelOptionsGroup title="Columns">
            <Switch label="Time" labelClass="width-5" checked={showTime} onChange={this.onToggleTime} />
            <Switch label="Labels" labelClass="width-5" checked={showLabels} onChange={this.onToggleLabels} />
          </PanelOptionsGroup>
          <PanelOptionsGroup title="De-duplication">
            <ToggleButtonGroup label="" transparent={true}>
              {//TODO: replace ToggleButtonGroup with new RadioButtonGroup beeing developed
              Object.keys(LogsDedupStrategy).map((dedupType: string, i) => (
                <ToggleButton
                  key={i}
                  value={dedupType}
                  onChange={this.onChangeDedup}
                  selected={dedupStrategy === dedupType}
                  // @ts-ignore
                  tooltip={LogsDedupDescription[dedupType]}
                >
                  {dedupType}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </PanelOptionsGroup>
        </PanelOptionsGrid>
      </>
    );
  }
}
