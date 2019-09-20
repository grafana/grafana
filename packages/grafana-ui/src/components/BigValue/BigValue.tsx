// Library
import React, { PureComponent, ReactNode, CSSProperties } from 'react';
import $ from 'jquery';
import { css, cx } from 'emotion';
import { DisplayValue } from '@grafana/data';

// Utils
import { getColorFromHexRgbOrName } from '../../utils';

// Types
import { Themeable } from '../../types';

export interface BigValueSparkline {
  data: any[][];
  minX: number;
  maxX: number;
}

export interface Props extends Themeable {
  height: number;
  width: number;
  value: DisplayValue;
  sparkline?: BigValueSparkline;
  onClick?: React.MouseEventHandler<HTMLElement>;
  className?: string;
}

/*
 * This visualization is still in POC state, needed more tests & better structure
 */
export class BigValue extends PureComponent<Props> {
  canvasElement: any;

  componentDidMount() {
    this.draw();
  }

  componentDidUpdate() {
    this.draw();
  }

  draw() {
    const { sparkline, theme } = this.props;

    if (sparkline && this.canvasElement) {
      const { data, minX, maxX } = sparkline;

      const options = {
        legend: { show: false },
        series: {
          lines: {
            show: true,
            fill: 1,
            zero: false,
            lineWidth: 1,
            fillColor: getColorFromHexRgbOrName('red', theme.type),
          },
        },
        yaxes: { show: false },
        xaxis: {
          show: false,
          min: minX,
          max: maxX,
        },
        grid: { hoverable: false, show: false },
      };

      const plotSeries = {
        data,
        color: getColorFromHexRgbOrName('green', theme.type),
      };

      try {
        $.plot(this.canvasElement, [plotSeries], options);
      } catch (err) {
        console.log('sparkline rendering error', err, options);
      }
    }
  }

  renderText = (value?: DisplayValue, padding?: string): ReactNode => {
    if (!value || !value.text) {
      return null;
    }
    const css: CSSProperties = {};
    if (padding) {
      css.padding = padding;
    }
    if (value.color) {
      css.color = value.color;
    }
    if (value.fontSize) {
      css.fontSize = value.fontSize;
    }

    return <span style={css}>{value.text}</span>;
  };

  renderSparkline(sparkline: BigValueSparkline) {
    const { height, width } = this.props;

    const plotCss: CSSProperties = {};
    plotCss.position = 'absolute';
    plotCss.bottom = '0px';
    plotCss.left = '0px';
    plotCss.width = width + 'px';
    plotCss.height = Math.floor(height * 0.25) + 'px';

    return <div style={plotCss} ref={element => (this.canvasElement = element)} />;
  }

  render() {
    const { height, width, value, sparkline, onClick, className } = this.props;

    return (
      <div
        className={cx(
          css({
            position: 'relative',
            display: 'table',
          }),
          className
        )}
        style={{ width, height }}
        onClick={onClick}
      >
        {value.title && (
          <div
            className={css({
              lineHeight: 1,
              textAlign: 'center',
              zIndex: 1,
              display: 'block',
              width: '100%',
              position: 'absolute',
            })}
          >
            {value.title}
          </div>
        )}

        <span
          className={css({
            lineHeight: 1,
            textAlign: 'center',
            zIndex: 1,
            display: 'table-cell',
            verticalAlign: 'middle',
            position: 'relative',
            fontSize: '3em',
            fontWeight: 500, // TODO: $font-weight-semi-bold
          })}
        >
          {this.renderText(value)}
        </span>

        {sparkline && this.renderSparkline(sparkline)}
      </div>
    );
  }
}
