// Libraries
import React, { Component } from 'react';

// Services & Utils
import { processTimeSeries, ThemeContext } from '@grafana/ui';

// Components
import { Gauge } from '@grafana/ui';

// Types
import { GaugeOptions } from './types';
import { PanelProps, NullValueMode, TimeSeriesValue } from '@grafana/ui/src/types';

interface Props extends PanelProps<GaugeOptions> {}
interface State {
  value: TimeSeriesValue;
}

export class GaugePanel extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      value: this.findValue(props),
    };
    console.log('CONSTRUCTOR!', this.props.data);
  }

  componentDidUpdate(prevProps: Props) {
    console.log('UPDATE', this.props.data);

    if (this.props.data !== prevProps.data) {
      this.setState({ value: this.findValue(this.props) });
    }
  }

  findValue(props: Props): number | null {
    const { data, options } = props;
    const { valueOptions } = options;

    console.log('FIND VALUE', data);

    if (data) {
      // For now, assume timeseries defaults
      const xColumn = 1; // time
      const yColumn = 0; // value
      const vmSeries = processTimeSeries({
        data,
        xColumn,
        yColumn,
        nullValueMode: NullValueMode.Null,
      });

      console.log('GOT', vmSeries);

      if (vmSeries[0]) {
        return vmSeries[0].stats[valueOptions.stat];
      }
    }
    return null;
  }

  render() {
    const { width, height, replaceVariables, options } = this.props;
    const { valueOptions } = options;
    const { value } = this.state;

    const prefix = replaceVariables(valueOptions.prefix);
    const suffix = replaceVariables(valueOptions.suffix);
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
