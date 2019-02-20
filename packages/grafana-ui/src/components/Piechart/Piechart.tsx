import React, { PureComponent } from 'react';

import { GrafanaThemeType } from '../../types';
import { Themeable } from '../../index';

export interface PiechartDataPoint {
  value: number;
  name: string;
  color: string;
}

export interface Props extends Themeable {
  height: number;
  width: number;
  datapoints: PiechartDataPoint[];

  unit: string;
  pieType: string;
  format: string;
  stat: string;
  strokeWidth: number;
}

export class Piechart extends PureComponent<Props> {
  canvasElement: any;

  static defaultProps = {
    pieType: 'pie',
    format: 'short',
    stat: 'current',
    strokeWidth: 1,
    theme: GrafanaThemeType.Dark,
  };

  componentDidMount() {
    this.draw();
  }

  componentDidUpdate() {
    this.draw();
  }

  draw() {
    // const { width, height, theme, value } = this.props;
  }

  render() {
    const { height, width } = this.props;

    return (
      <div className="piechart-panel">
        <div
          style={{
            height: `${height * 0.9}px`,
            width: `${Math.min(width, height * 1.3)}px`,
            top: '10px',
            margin: 'auto',
          }}
          ref={element => (this.canvasElement = element)}
        />
      </div>
    );
  }
}

export default Piechart;
