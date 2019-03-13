import React, { PureComponent } from 'react';
import { VizOrientation } from '../../types';

interface RenderProps<T> {
  vizWidth: number;
  vizHeight: number;
  value: T;
}

interface Props<T> {
  children: (renderProps: RenderProps<T>) => JSX.Element | JSX.Element[];
  height: number;
  width: number;
  values: T[];
  orientation: VizOrientation;
}

const SPACE_BETWEEN = 10;

export class VizRepeater<T> extends PureComponent<Props<T>> {
  getOrientation(): VizOrientation {
    const { orientation, width, height } = this.props;

    if (orientation === VizOrientation.Auto) {
      if (width > height) {
        return VizOrientation.Vertical;
      } else {
        return VizOrientation.Horizontal;
      }
    }

    return orientation;
  }

  render() {
    const { children, height, values, width } = this.props;
    const orientation = this.getOrientation();

    const itemStyles: React.CSSProperties = {
      display: 'flex',
    };

    const repeaterStyle: React.CSSProperties = {
      display: 'flex',
    };

    let vizHeight = height;
    let vizWidth = width;

    if (orientation === VizOrientation.Horizontal) {
      repeaterStyle.flexDirection = 'column';
      itemStyles.margin = `${SPACE_BETWEEN / 2}px 0`;
      vizWidth = width;
      vizHeight = height / values.length - SPACE_BETWEEN;
    } else {
      repeaterStyle.flexDirection = 'row';
      itemStyles.margin = `0 ${SPACE_BETWEEN / 2}px`;
      vizHeight = height;
      vizWidth = width / values.length - SPACE_BETWEEN;
    }

    itemStyles.width = `${vizWidth}px`;
    itemStyles.height = `${vizHeight}px`;

    return (
      <div style={repeaterStyle}>
        {values.map((value, index) => {
          return (
            <div key={index} style={itemStyles}>
              {children({ vizHeight, vizWidth, value })}
            </div>
          );
        })}
      </div>
    );
  }
}
