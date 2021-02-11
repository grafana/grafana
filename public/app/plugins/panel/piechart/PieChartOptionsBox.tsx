import React, { PureComponent } from 'react';
import { LegacyForms, InlineFormLabel, PieChartType } from '@grafana/ui';
import { PanelEditorProps } from '@grafana/data';
import { PieChartOptions } from './types';

const { Select } = LegacyForms;
const labelWidth = 8;

const pieChartOptions = [
  { value: PieChartType.Pie, label: 'Pie' },
  { value: PieChartType.Donut, label: 'Donut' },
];

export class PieChartOptionsBox extends PureComponent<PanelEditorProps<PieChartOptions>> {
  onPieTypeChange = (pieType: any) => this.props.onOptionsChange({ ...this.props.options, pieType: pieType.value });

  render() {
    const { options } = this.props;
    const { pieType } = options;

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
      </>
    );
  }
}
