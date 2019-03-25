// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { config } from 'app/core/config';

// Components
import { PieChart } from '@grafana/ui';

// Types
import { PieChartOptions } from './types';
import { PanelProps } from '@grafana/ui/src/types';
import { getSingleStatValues } from '../singlestat2/SingleStatPanel';

interface Props extends PanelProps<PieChartOptions> {}

export class PieChartPanel extends PureComponent<Props> {
  render() {
    const { width, height, options } = this.props;

    const values = getSingleStatValues(this.props);

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
