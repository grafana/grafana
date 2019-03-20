// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { config } from 'app/core/config';
import { getColorFromHexRgbOrName } from '@grafana/ui/src/utils';

// Components
import { Gauge } from '@grafana/ui';
import { HeatmapCanvas } from './HeatmapCanvas';

// Types
import { LHeatmapOptions } from './types';
import { DisplayValue, PanelProps } from '@grafana/ui';

interface LHeatmapPanelState {
  pointValue: number;
  pointLabels: string[];
}

export class LHeatmapPanel extends PureComponent<PanelProps<LHeatmapOptions>, LHeatmapPanelState> {
  constructor(props) {
    super(props);
    this.state = {
      pointValue: null,
      pointLabels: [],
    };
  }

  handlePointHover = (value: number, labels: string[]) => {
    // console.log(labels, value);
    this.setState({
      pointValue: value,
      pointLabels: labels,
    });
  };

  handlePointClick = (labels: string[]) => {
    console.log('click on', labels);
  };

  valueToColor = (value: number) => {
    const thresholds = this.props.options.thresholds;
    let color = getColorFromHexRgbOrName(thresholds[0].color);
    for (const threshold of thresholds) {
      if (value > threshold.value) {
        color = getColorFromHexRgbOrName(threshold.color);
      }
    }
    return color;
  };

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
    const { height, width, panelData } = this.props;
    const heatmapData = panelData.timeSeries[0][0];
    const labels = panelData.timeSeries[0][1];
    return (
      <div className="linkedin-heatmap-poc">
        <HeatmapCanvas
          width={width}
          height={height - 40}
          data={heatmapData}
          labels={labels}
          valueToColor={this.valueToColor}
          onPointHover={this.handlePointHover}
          onPointClick={this.handlePointClick}
        />
        <div className="linkedin-heatmap-value-container" style={{ padding: '8px' }}>
          <span>
            {this.state.pointLabels[0]} - {this.state.pointLabels[1]}
          </span>
          <span style={{ marginLeft: '8px' }}>{this.state.pointValue}</span>
        </div>
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
