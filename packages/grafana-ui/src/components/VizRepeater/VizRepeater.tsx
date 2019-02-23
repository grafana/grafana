import React, { PureComponent } from 'react';
import { SingleStatValueInfo } from '../../types';

interface RenderProps {
  vizWidth: number;
  vizHeight: number;
  valueInfo: SingleStatValueInfo;
}

interface Props {
  children: (renderProps: RenderProps) => JSX.Element | JSX.Element[];
  height: number;
  width: number;
  values: SingleStatValueInfo[];
  orientation?: string;
}

export class VizRepeater extends PureComponent<Props> {
  render() {
    const { children, orientation, height, values, width } = this.props;

    const vizContainerWidth = (1 / values.length) * 100;
    const vizContainerHeight = (1 / values.length) * 100;
    const repeatingVizWidth = Math.floor(width / values.length) - 10; // make Gauge slightly smaller than panel.
    const repeatingVizHeight = Math.floor(height / values.length) - 10;

    const horizontalVisualization = {
      display: 'flex',
      height: height,
      width: `${vizContainerWidth}%`,
    };

    const verticalVisualization = {
      display: 'flex',
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
        {values.map((valueInfo, index) => {
          return (
            <div key={index} style={vizContainerStyle}>
              {children({ vizHeight, vizWidth, valueInfo })}
            </div>
          );
        })}
      </div>
    );
  }
}
