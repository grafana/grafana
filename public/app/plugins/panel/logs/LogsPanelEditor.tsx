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
  onToggleTime = () => {
    const { options, onOptionsChange } = this.props;
    const { showTime } = options;

    onOptionsChange({ ...options, showTime: !showTime });
  };

  onShowValuesChange = (item: SelectableValue<SortOrder>) => {
    const { options, onOptionsChange } = this.props;
    onOptionsChange({ ...options, sortOrder: item.value });
  };

  render() {
    const { showTime, sortOrder } = this.props.options;
    const value = sortOrderOptions.filter(option => option.value === sortOrder)[0];

    return (
      <>
        <PanelOptionsGrid>
          <PanelOptionsGroup title="Columns">
            <Switch label="Time" labelClass="width-10" checked={showTime} onChange={this.onToggleTime} />
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
