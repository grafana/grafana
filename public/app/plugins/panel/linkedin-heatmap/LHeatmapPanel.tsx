// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { config } from 'app/core/config';

// Components
import { Gauge } from '@grafana/ui';
import { HeatmapCanvas } from './HeatmapCanvas';

// Types
import { LHeatmapOptions } from './types';
import { DisplayValue, PanelProps } from '@grafana/ui';

export class LHeatmapPanel extends PureComponent<PanelProps<LHeatmapOptions>> {
  renderValue = (value: DisplayValue, width: number, height: number): JSX.Element => {
    const { options } = this.props;

    return (
      <Gauge
        value={value}
        width={width}
        height={height}
        thresholds={options.thresholds}
        showThresholdLabels={options.showThresholdLabels}
        showThresholdMarkers={options.showThresholdMarkers}
        minValue={options.minValue}
        maxValue={options.maxValue}
        theme={config.theme}
      />
    );
  };

  getProcessedValues = (): DisplayValue[] => {
    return [];
  };

  render() {
    console.log(this.props);
    const { height, width, panelData } = this.props;
    const heatmapData = panelData.timeSeries[0][0];
    const labels = panelData.timeSeries[0][1];
    return (
      <div className="linkedin-heatmap-poc">
        <HeatmapCanvas data={heatmapData} labels={labels} width={width} height={height} />
      </div>
      // <Graph
      //   timeSeries={vmSeries}
      //   timeRange={timeRange}
      //   showLines={showLines}
      //   showPoints={showPoints}
      //   showBars={showBars}
      //   width={width}
      //   height={height}
      // />
    );
  }
}
