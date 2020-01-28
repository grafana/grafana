// Libraries
import React, { PureComponent } from 'react';
import { Switch, PanelOptionsGrid, PanelOptionsGroup, FormLabel, Select } from '@grafana/ui';

// Types
import { Options } from './types';
import { SortOrder } from 'app/core/utils/explore';
import { PanelEditorProps, SelectableValue } from '@grafana/data';

const sortOrderOptions = [
  { value: SortOrder.Descending, label: 'Descending' },
  { value: SortOrder.Ascending, label: 'Ascending' },
];

export class LogsPanelEditor extends PureComponent<PanelEditorProps<Options>> {
  onToggleLabels = () => {
    const { options, onOptionsChange } = this.props;
    const { showLabels } = options;

    onOptionsChange({ ...options, showLabels: !showLabels });
  };

  onToggleTime = () => {
    const { options, onOptionsChange } = this.props;
    const { showTime } = options;

    onOptionsChange({ ...options, showTime: !showTime });
  };

  onTogglewrapLogMessage = () => {
    const { options, onOptionsChange } = this.props;
    const { wrapLogMessage } = options;

    onOptionsChange({ ...options, wrapLogMessage: !wrapLogMessage });
  };

  onShowValuesChange = (item: SelectableValue<SortOrder>) => {
    const { options, onOptionsChange } = this.props;
    onOptionsChange({ ...options, sortOrder: item.value });
  };

  render() {
    const { showLabels, showTime, wrapLogMessage, sortOrder } = this.props.options;
    const value = sortOrderOptions.filter(option => option.value === sortOrder)[0];

    return (
      <>
        <PanelOptionsGrid>
          <PanelOptionsGroup title="Columns">
            <Switch label="Time" labelClass="width-10" checked={showTime} onChange={this.onToggleTime} />
            <Switch label="Unique labels" labelClass="width-10" checked={showLabels} onChange={this.onToggleLabels} />
            <Switch
              label="Wrap lines"
              labelClass="width-10"
              checked={wrapLogMessage}
              onChange={this.onTogglewrapLogMessage}
            />
            <div className="gf-form">
              <FormLabel>Order</FormLabel>
              <Select options={sortOrderOptions} value={value} onChange={this.onShowValuesChange} />
            </div>
          </PanelOptionsGroup>
        </PanelOptionsGrid>
      </>
    );
  }
}
