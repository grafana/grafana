import React, { PureComponent } from 'react';
import { LegacyForms, InlineFormLabel, PieChartType } from '@grafana/ui';
import { PanelEditorProps } from '@grafana/data';
import { PieChartOptions } from './types';

const { Select, FormField } = LegacyForms;
const labelWidth = 8;

const pieChartOptions = [
  { value: PieChartType.PIE, label: 'Pie' },
  { value: PieChartType.DONUT, label: 'Donut' },
];

export class PieChartOptionsBox extends PureComponent<PanelEditorProps<PieChartOptions>> {
  onPieTypeChange = (pieType: any) => this.props.onOptionsChange({ ...this.props.options, pieType: pieType.value });
  onStrokeWidthChange = ({ target }: any) =>
    this.props.onOptionsChange({ ...this.props.options, strokeWidth: target.value });

  render() {
    const { options } = this.props;
    const { pieType, strokeWidth } = options;

    return (
      <>
        <div className="gf-form">
          <InlineFormLabel width={labelWidth}>Type</InlineFormLabel>
          <Select
            width={12}
            options={pieChartOptions}
            onChange={this.onPieTypeChange}
            value={pieChartOptions.find((option) => option.value === pieType)}
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
      </>
    );
  }
}
