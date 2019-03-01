// Libraries
import React, { PureComponent } from 'react';

// Components
import { Select, FormLabel, PanelOptionsGroup } from '@grafana/ui';

// Types
import { FormField, PanelEditorProps } from '@grafana/ui';
import { PiechartType } from '@grafana/ui';
import { PiechartOptions } from './types';

import * as _ from 'lodash';


const labelWidth = 8;

const piechartOptions = [
  { value: PiechartType.PIE, label: 'Pie' },
  { value: PiechartType.DONUT, label: 'Donut' },
];

export class PiechartOptionsBox extends PureComponent<PanelEditorProps<PiechartOptions>> {
  onPieTypeChange = ({ target }) => this.props.onChange({ ...this.props.options, pieType: target.value });
  onStrokeWidthChange = ({ target }) => this.props.onChange({ ...this.props.options, strokeWidth: target.value });

  render() {
    const { options } = this.props;
    const { pieType, strokeWidth } = options;

    return (
      <PanelOptionsGroup title="Piechart">
        <div className="gf-form">
          <FormLabel width={labelWidth}>Type</FormLabel>
          <Select
            width={12}
            options={piechartOptions}
            onChange={this.onPieTypeChange}
            value={piechartOptions.find(option => option.value === pieType)}
          />
        </div>
        <div className="gf-form">
          <FormField label="Divider width" labelWidth={labelWidth} onChange={this.onStrokeWidthChange} value={strokeWidth} />
        </div>
      </PanelOptionsGroup>
    );
  }
}
