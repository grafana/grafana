// Libraries
import React, { PureComponent } from 'react';

// Components
import { Select, FormLabel, PanelOptionsGroup } from '@grafana/ui';

// Types
import { PanelEditorProps } from '@grafana/data';
import { FormField, PieChartType } from '@grafana/ui';
import { PieChartOptions } from './types';

const labelWidth = 8;

const pieChartOptions = [{ value: PieChartType.PIE, label: 'Pie' }, { value: PieChartType.DONUT, label: 'Donut' }];

export class PieChartOptionsBox extends PureComponent<PanelEditorProps<PieChartOptions>> {
  onPieTypeChange = (pieType: any) => this.props.onOptionsChange({ ...this.props.options, pieType: pieType.value });
  onStrokeWidthChange = ({ target }: any) =>
    this.props.onOptionsChange({ ...this.props.options, strokeWidth: target.value });

  render() {
    const { options } = this.props;
    const { pieType, strokeWidth } = options;

    return (
      <PanelOptionsGroup title="PieChart">
        <div className="gf-form">
          <FormLabel width={labelWidth}>Type</FormLabel>
          <Select
            width={12}
            options={pieChartOptions}
            onChange={this.onPieTypeChange}
            value={pieChartOptions.find(option => option.value === pieType)}
          />
        </div>
        <div className="gf-form">
          <FormField
            label="Divider width"
            labelWidth={labelWidth}
            onChange={this.onStrokeWidthChange}
            value={strokeWidth}
          />
        </div>
      </PanelOptionsGroup>
    );
  }
}
