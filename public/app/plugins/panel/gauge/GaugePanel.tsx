// Libraries
import React, { Component } from 'react';

// Services & Utils
import { ThemeContext } from '@grafana/ui';

// Components
import { Gauge } from '@grafana/ui';

// Types
import { GaugeOptions } from './types';
import { PanelProps, TimeSeriesValue } from '@grafana/ui/src/types';
import { calculateSimpleStats } from '@grafana/ui/src/utils/processData';

interface Props extends PanelProps<GaugeOptions> {}

interface State {
  values?: TimeSeriesValue[];
}

export class GaugePanel extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      values: this.calculateStats(),
    };
  }

  componentDidUpdate(prevProps: Props) {
    const { panelData, options } = this.props;

    if (panelData !== prevProps.panelData || options.valueOptions.stat !== prevProps.options.valueOptions.stat) {
      this.setState({ values: this.calculateStats() });
    }
  }

  calculateStats(): TimeSeriesValue[] {
    const { panelData, options } = this.props;
    const { valueOptions } = options;

    // For now assume we are always looking at the first value
    const dimension = 0;

    return panelData.data.map((data, index) => {
      const stats = calculateSimpleStats(data, dimension);
      return stats[valueOptions.stat];
    });
  }

  render() {
    const { width, height, onInterpolate, options } = this.props;
    const { valueOptions } = options;
    const { values } = this.state;

    const prefix = onInterpolate(valueOptions.prefix);
    const suffix = onInterpolate(valueOptions.suffix);

    let value: TimeSeriesValue;

    if (values && values.length > 0) {
      value = values[0]; // for now
    } else {
      return <div>no data yet...</div>;
    }

    return (
      <ThemeContext.Consumer>
        {theme => (
          <Gauge
            value={value}
            width={width}
            height={height}
            prefix={prefix}
            suffix={suffix}
            unit={valueOptions.unit}
            decimals={valueOptions.decimals}
            thresholds={options.thresholds}
            valueMappings={options.valueMappings}
            showThresholdLabels={options.showThresholdLabels}
            showThresholdMarkers={options.showThresholdMarkers}
            minValue={options.minValue}
            maxValue={options.maxValue}
            theme={theme}
          />
        )}
      </ThemeContext.Consumer>
    );
  }
}
