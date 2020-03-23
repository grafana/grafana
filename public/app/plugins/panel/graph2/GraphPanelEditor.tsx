//// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';

// Types
import { FieldConfig, PanelEditorProps } from '@grafana/data';
import {
  Switch,
  LegendOptions,
  GraphTooltipOptions,
  PanelOptionsGrid,
  PanelOptionsGroup,
  Select,
  FieldPropertiesEditor,
} from '@grafana/ui';
import { Options, GraphOptions } from './types';
import { GraphLegendEditor } from './GraphLegendEditor';
import { NewPanelEditorContext } from 'app/features/dashboard/components/PanelEditor/PanelEditor';

export class GraphPanelEditor extends PureComponent<PanelEditorProps<Options>> {
  onGraphOptionsChange = (options: Partial<GraphOptions>) => {
    this.props.onOptionsChange({
      ...this.props.options,
      graph: {
        ...this.props.options.graph,
        ...options,
      },
    });
  };

  onLegendOptionsChange = (options: LegendOptions) => {
    this.props.onOptionsChange({ ...this.props.options, legend: options });
  };

  onTooltipOptionsChange = (options: GraphTooltipOptions) => {
    this.props.onOptionsChange({ ...this.props.options, tooltipOptions: options });
  };

  onToggleLines = () => {
    this.onGraphOptionsChange({ showLines: !this.props.options.graph.showLines });
  };

  onToggleBars = () => {
    this.onGraphOptionsChange({ showBars: !this.props.options.graph.showBars });
  };

  onTogglePoints = () => {
    this.onGraphOptionsChange({ showPoints: !this.props.options.graph.showPoints });
  };

  onDefaultsChange = (field: FieldConfig, event?: React.SyntheticEvent<HTMLElement>, callback?: () => void) => {
    this.props.onFieldConfigChange({
      ...this.props.fieldConfig,
      defaults: field,
    });
  };

  render() {
    const {
      graph: { showBars, showPoints, showLines },
      tooltipOptions: { mode },
    } = this.props.options;

    return (
      <NewPanelEditorContext.Consumer>
        {useNewEditor => {
          return (
            <>
              <div className="section gf-form-group">
                <h5 className="section-heading">Draw Modes</h5>
                <Switch label="Lines" labelClass="width-5" checked={showLines} onChange={this.onToggleLines} />
                <Switch label="Bars" labelClass="width-5" checked={showBars} onChange={this.onToggleBars} />
                <Switch label="Points" labelClass="width-5" checked={showPoints} onChange={this.onTogglePoints} />
              </div>
              <PanelOptionsGrid>
                <>
                  {!useNewEditor && (
                    <PanelOptionsGroup title="Field">
                      <FieldPropertiesEditor
                        showMinMax={false}
                        onChange={this.onDefaultsChange}
                        value={this.props.fieldConfig.defaults}
                      />
                    </PanelOptionsGroup>
                  )}
                </>
                <PanelOptionsGroup title="Tooltip">
                  <Select
                    value={{ value: mode, label: mode === 'single' ? 'Single' : 'All series' }}
                    onChange={value => {
                      this.onTooltipOptionsChange({ mode: value.value as any });
                    }}
                    options={[
                      { label: 'All series', value: 'multi' },
                      { label: 'Single', value: 'single' },
                    ]}
                  />
                </PanelOptionsGroup>
                <GraphLegendEditor options={this.props.options.legend} onChange={this.onLegendOptionsChange} />
              </PanelOptionsGrid>
            </>
          );
        }}
      </NewPanelEditorContext.Consumer>
    );
  }
}
