// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';

// Services & Utils
import { config } from 'app/core/config';
import { processTimeSeries } from '@grafana/ui/src/utils';
import { getColorFromHexRgbOrName } from '@grafana/ui/src/utils';

// Components
import { Gauge, Graph, TimeSeriesVMs } from '@grafana/ui';
import { HeatmapCanvas } from './HeatmapCanvas';

// Types
import { LHeatmapOptions } from './types';
import { DisplayValue, PanelProps } from '@grafana/ui';
import { NullValueMode } from '@grafana/ui/src/types';

interface LHeatmapPanelState {
  pointValue: number;
  pointLabels: string[];
}

export class LHeatmapPanel extends PureComponent<PanelProps<LHeatmapOptions>, LHeatmapPanelState> {
  heatmapData: any;
  labels: any;
  customQuery: string;

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
    const target = this.props.targets[0];
    const query = target.expr;
    const interpolatedLabels = [`${target.xAxisLabel}="${labels[0]}"`, `${target.yAxisLabel}="${labels[1]}"`];
    const modifiedQuery = addLabelsToPromQuery(query, interpolatedLabels);
    console.log(query, modifiedQuery);
    if (this.props.onCustomQuery) {
      this.customQuery = modifiedQuery;
      this.props.onCustomQuery(modifiedQuery);
    }
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
    // console.log(this.props);
    const { height, width, panelData, timeRange } = this.props;
    const data = panelData.timeSeries[0];
    let heatmapData, labels, vmSeries: TimeSeriesVMs;
    if (!data || (data && !_.isArray(data))) {
      heatmapData = this.heatmapData;
      labels = this.labels;
      vmSeries = processTimeSeries({
        timeSeries: panelData.timeSeries,
        nullValueMode: NullValueMode.Ignore,
      });
    } else {
      heatmapData = data[0];
      labels = data[1];
      this.heatmapData = heatmapData;
      this.labels = labels;
    }
    const pointValue = this.state.pointValue || 'null';

    return (
      <div className="linkedin-heatmap-poc">
        <div style={{ display: 'flex' }}>
          <HeatmapCanvas
            width={width / 2}
            height={height - 40}
            data={heatmapData}
            labels={labels}
            valueToColor={this.valueToColor}
            onPointHover={this.handlePointHover}
            onPointClick={this.handlePointClick}
          />
          {vmSeries && (
            <div className="linkedin-heatmap-graph-container" style={{ width: width / 2, height: height / 2 }}>
              <Graph timeSeries={vmSeries} timeRange={timeRange} showLines={true} width={width / 2} height={height} />
            </div>
          )}
        </div>
        <div className="linkedin-heatmap-value-container" style={{ padding: '8px' }}>
          <span>
            {this.state.pointLabels[0]} - {this.state.pointLabels[1]}
          </span>
          <span style={{ marginLeft: '8px' }}>{pointValue}</span>
        </div>
      </div>
    );
  }
}

function addLabelsToPromQuery(query: string, labels: string[]) {
  const selectorOpenIndex = query.indexOf('{');
  const selectorCloseIndex = query.indexOf('}');
  if (selectorOpenIndex < 0) {
    return query;
  }
  const labelsStr = labels.join(',');
  if (selectorCloseIndex - selectorOpenIndex === 1) {
    return query.slice(0, selectorOpenIndex + 1) + labelsStr + query.slice(selectorCloseIndex);
  }
  return query.slice(0, selectorOpenIndex + 1) + labelsStr + ',' + query.slice(selectorOpenIndex + 1);
}
