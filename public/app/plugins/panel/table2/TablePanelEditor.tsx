//// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';

// Types
import { TablePanelOptions } from './types';
import {
  Switch,
  FormField,
  ThresholdsEditor,
  PanelOptionsGrid,
  ValueMappingsEditor,
  FieldPropertiesEditor,
  PanelOptionsGroup,
  DataLinksEditor,
} from '@grafana/ui';
import { PanelEditorProps, FieldDisplayOptions, Threshold, ValueMapping, FieldConfig, DataLink } from '@grafana/data';

import { getCalculationValueDataLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

export class TablePanelEditor extends PureComponent<PanelEditorProps<TablePanelOptions>> {
  onToggleShowHeader = () => {
    this.props.onOptionsChange({ ...this.props.options, showHeader: !this.props.options.showHeader });
  };

  onToggleFixedHeader = () => {
    this.props.onOptionsChange({ ...this.props.options, fixedHeader: !this.props.options.fixedHeader });
  };

  onToggleRotate = () => {
    this.props.onOptionsChange({ ...this.props.options, rotate: !this.props.options.rotate });
  };

  onFixedColumnsChange = ({ target }: any) => {
    this.props.onOptionsChange({ ...this.props.options, fixedColumns: target.value });
  };

  onThresholdsChanged = (thresholds: Threshold[]) => {
    const current = this.props.options.fieldOptions.defaults;
    this.onDefaultsChange({
      ...current,
      thresholds,
    });
  };

  onValueMappingsChanged = (mappings: ValueMapping[]) => {
    const current = this.props.options.fieldOptions.defaults;
    this.onDefaultsChange({
      ...current,
      mappings,
    });
  };

  onDisplayOptionsChanged = (
    fieldOptions: FieldDisplayOptions,
    event?: React.SyntheticEvent<HTMLElement>,
    callback?: () => void
  ) =>
    this.props.onOptionsChange(
      {
        ...this.props.options,
        fieldOptions,
      },
      callback
    );

  onDefaultsChange = (field: FieldConfig, event?: React.SyntheticEvent<HTMLElement>, callback?: () => void) => {
    this.onDisplayOptionsChanged(
      {
        ...this.props.options.fieldOptions,
        defaults: field,
      },
      event,
      callback
    );
  };

  onDataLinksChanged = (links: DataLink[], callback?: () => void) => {
    this.onDefaultsChange(
      {
        ...this.props.options.fieldOptions.defaults,
        links,
      },
      undefined,
      callback
    );
  };

  render() {
    const { showHeader, fixedHeader, rotate, fixedColumns, fieldOptions } = this.props.options;
    const { defaults } = fieldOptions;

    // Values based on the row/columns
    const suggestions = getCalculationValueDataLinksVariableSuggestions(this.props.data.series);

    return (
      <>
        <PanelOptionsGrid>
          <PanelOptionsGroup title="Display">
            <div className="section gf-form-group">
              <h5 className="section-heading">Header</h5>
              <Switch label="Show" labelClass="width-6" checked={showHeader} onChange={this.onToggleShowHeader} />
              <Switch label="Fixed" labelClass="width-6" checked={fixedHeader} onChange={this.onToggleFixedHeader} />
            </div>

            <div className="section gf-form-group">
              <h5 className="section-heading">Display</h5>
              <Switch label="Rotate" labelClass="width-8" checked={rotate} onChange={this.onToggleRotate} />
              <FormField
                label="Fixed Columns"
                labelWidth={8}
                inputWidth={4}
                type="number"
                step="1"
                min="0"
                max="100"
                onChange={this.onFixedColumnsChange}
                value={fixedColumns}
              />
            </div>
          </PanelOptionsGroup>

          <PanelOptionsGroup title="Field">
            <FieldPropertiesEditor showMinMax={false} onChange={this.onDefaultsChange} value={defaults} />
          </PanelOptionsGroup>

          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={defaults.thresholds} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={defaults.mappings} />

        <PanelOptionsGroup title="Data links">
          <DataLinksEditor
            value={defaults.links}
            onChange={this.onDataLinksChanged}
            suggestions={suggestions}
            maxLinks={10}
          />
        </PanelOptionsGroup>
      </>
    );
  }
}
