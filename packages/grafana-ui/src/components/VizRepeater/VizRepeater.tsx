import React, { PureComponent } from 'react';
import { SingleStatValueInfo, VizOrientation } from '../../types';

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
  orientation: VizOrientation;
}

const SPACE_BETWEEN = 10;

export class VizRepeater extends PureComponent<Props> {
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
        {values.map((valueInfo, index) => {
          return (
            <div key={index} style={itemStyles}>
              {children({ vizHeight, vizWidth, valueInfo })}
            </div>
          );
        })}
      </div>
    );
  }
}
