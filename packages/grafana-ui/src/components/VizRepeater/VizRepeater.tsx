import { Component } from 'react';
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
}

export class VizRepeater extends Component<Props> {
  render() {
    const { children, height, timeSeries, width } = this.props;

    const singleStatWidth = 1 / timeSeries.length * 100;
    const singleStatHeight = 1 / timeSeries.length * 100;
    const repeatingGaugeWidth = Math.floor(width / timeSeries.length) - 10; // make Gauge slightly smaller than panel.
    const repeatingGaugeHeight = Math.floor(height / timeSeries.length) - 10;

    const horizontalPanels = {
      display: 'inline-block',
      height: height,
      width: `${singleStatWidth}%`,
    };

    const verticalPanels = {
      display: 'block',
      width: width,
      height: `${singleStatHeight}%`,
    };

    let vizContainerStyle = {};
    let vizWidth = width;
    let vizHeight = height;

    if (width > height) {
      vizContainerStyle = horizontalPanels;
      vizWidth = repeatingGaugeWidth;
    } else if (height > width) {
      vizContainerStyle = verticalPanels;
      vizHeight = repeatingGaugeHeight;
    }

    return children({
      vizHeight,
      vizWidth,
      vizContainerStyle,
    });
  }
}
