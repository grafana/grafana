// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { config } from 'app/core/config';

// Components
import { PieChart } from '@grafana/ui';
import { getFieldDisplayValues } from '@grafana/data';

// Types
import { PieChartOptions } from './types';
import { PanelProps } from '@grafana/data';

interface Props extends PanelProps<PieChartOptions> {}

export class PieChartPanel extends PureComponent<Props> {
  render() {
    const { width, height, options, data, replaceVariables, fieldConfig, timeZone } = this.props;

    const values = getFieldDisplayValues({
      fieldConfig,
      reduceOptions: options.reduceOptions,
      data: data.series,
      theme: config.theme,
      replaceVariables: replaceVariables,
      timeZone,
    }).map(v => v.display);

    return (
      <PieChart
        width={width}
        height={height}
        values={values}
        pieType={options.pieType}
        strokeWidth={options.strokeWidth}
        theme={config.theme}
      />
    );
  }
}
