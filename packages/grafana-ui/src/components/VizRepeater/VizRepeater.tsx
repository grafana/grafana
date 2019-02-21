import React, { PureComponent } from 'react';
import { TimeSeriesVMs } from '../../types';

interface RenderProps {
  vizWidth: number;
  vizHeight: number;
  vizContainerStyle: React.CSSProperties;
}

interface Props {
  children: (renderProps: RenderProps) => JSX.Element | JSX.Element[];
  height: number;
  width: number;
  timeSeries: TimeSeriesVMs;
  orientation?: string;
}

export class VizRepeater extends PureComponent<Props> {
  render() {
    const { children, orientation, height, timeSeries, width } = this.props;

    const vizContainerWidth = (1 / timeSeries.length) * 100;
    const vizContainerHeight = (1 / timeSeries.length) * 100;
    const repeatingVizWidth = Math.floor(width / timeSeries.length) - 10; // make Gauge slightly smaller than panel.
    const repeatingVizHeight = Math.floor(height / timeSeries.length) - 10;

    const horizontalVisualization = {
      height: height,
      width: `${vizContainerWidth}%`,
    };

    const verticalVisualization = {
      width: width,
      height: `${vizContainerHeight}%`,
    };

    const repeaterStyle = {
      display: 'flex',
      flexDirection: orientation === 'vertical' || height > width ? 'column' : 'row',
    } as React.CSSProperties;

    let vizContainerStyle = {};
    let vizWidth = width;
    let vizHeight = height;

    if ((orientation && orientation === 'horizontal') || width > height) {
      vizContainerStyle = horizontalVisualization;
      vizWidth = repeatingVizWidth;
    }

    if ((orientation && orientation === 'vertical') || height > width) {
      vizContainerStyle = verticalVisualization;
      vizHeight = repeatingVizHeight;
    }

    return (
      <div style={repeaterStyle}>
        {children({
          vizHeight,
          vizWidth,
          vizContainerStyle,
        })}
      </div>
    );
  }
}
