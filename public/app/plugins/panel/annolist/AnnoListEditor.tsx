// Libraries
import React, { PureComponent, ChangeEvent } from 'react';

// Components
import {
  PanelEditorProps,
  PanelOptionsGroup,
  PanelOptionsGrid,
  Switch,
  FormField,
  toIntegerOrUndefined,
  toNumberString,
} from '@grafana/ui';

// Types
import { AnnoOptions } from './types';

export class AnnoListEditor extends PureComponent<PanelEditorProps<AnnoOptions>> {
  // Display
  //-----------

  onToggleShowUser = () =>
    this.props.onOptionsChange({ ...this.props.options, showUser: !this.props.options.showUser });

  onToggleShowTime = () =>
    this.props.onOptionsChange({ ...this.props.options, showTime: !this.props.options.showTime });

  onToggleShowTags = () =>
    this.props.onOptionsChange({ ...this.props.options, showTags: !this.props.options.showTags });

  // Navigate
  //-----------

  // Search
  //-----------
  onLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    const v = toIntegerOrUndefined(event.target.value);
    this.props.onOptionsChange({ ...this.props.options, limit: v });
  };

  render() {
    const { options } = this.props;
    const labelWidth = 8;

    return (
      <PanelOptionsGrid>
        <PanelOptionsGroup title="Display">
          <Switch
            label="Show User"
            labelClass={`width-${labelWidth}`}
            checked={options.showUser}
            onChange={this.onToggleShowUser}
          />
          <Switch
            label="Show Time"
            labelClass={`width-${labelWidth}`}
            checked={options.showTime}
            onChange={this.onToggleShowTime}
          />
          <Switch
            label="Show Tags"
            labelClass={`width-${labelWidth}`}
            checked={options.showTags}
            onChange={this.onToggleShowTags}
          />
        </PanelOptionsGroup>
        <PanelOptionsGroup title="Navigate">
          <div>TODO... Before</div>
          <div>TODO... After</div>
          <Switch
            label="To Panel"
            labelClass={`width-${labelWidth}`}
            checked={options.navigateToPanel}
            onChange={this.onToggleShowTags}
          />
        </PanelOptionsGroup>
        <PanelOptionsGroup title="Search">
          <Switch
            label="Only This Dashboard"
            labelClass={`width-12`}
            checked={options.onlyFromThisDashboard}
            onChange={this.onToggleShowTags}
          />
          <Switch
            label="Within Time Range"
            labelClass={`width-12`}
            checked={options.onlyInTimeRange}
            onChange={this.onToggleShowTags}
          />
          <div>TODO: Tags input</div>
          <FormField
            label="Min"
            labelWidth={labelWidth}
            onChange={this.onLimitChange}
            value={toNumberString(options.limit)}
            type="number"
          />
        </PanelOptionsGroup>
      </PanelOptionsGrid>
    );
  }
}
