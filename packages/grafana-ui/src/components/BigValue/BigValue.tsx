// Library
import React, { PureComponent, ReactNode, CSSProperties } from 'react';
import $ from 'jquery';
import { css, cx } from 'emotion';
import { DisplayValue } from '@grafana/data';

// Utils
import { getColorFromHexRgbOrName } from '../../utils';

// Types
import { Themeable } from '../../types';
import { stylesFactory } from '../../themes/stylesFactory';

export interface BigValueSparkline {
  data: any[][]; // [[number,number]]
  minX: number;
  maxX: number;
  full: boolean; // full height
  fillColor: string;
  lineColor: string;
}

export interface Props extends Themeable {
  height: number;
  width: number;
  value: DisplayValue;
  prefix?: DisplayValue;
  suffix?: DisplayValue;
  sparkline?: BigValueSparkline;
  backgroundColor?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  className?: string;
}

const getStyles = stylesFactory(() => {
  return {
    wrapper: css`
      position: 'relative';
      display: 'table';
    `,
    title: css`
      line-height: 1;
      text-align: 'center';
      z-index: 1;
      display: 'block';
      width: '100%';
      position: 'absolute';
    `,
    value: css`
      line-height: 1;
      text-align: 'center';
      z-index: 1;
      display: 'table-cell';
      vertical-align: 'middle';
      position: 'relative';
      font-size: '3em';
      font-weight: 500;
    `,
  };
});

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
      const { data, minX, maxX, fillColor, lineColor } = sparkline;

      const options = {
        legend: { show: false },
        series: {
          lines: {
            show: true,
            fill: 1,
            zero: false,
            lineWidth: 1,
            fillColor: getColorFromHexRgbOrName(fillColor, theme.type),
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
        color: getColorFromHexRgbOrName(lineColor, theme.type),
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

    if (sparkline.full) {
      const dynamicHeightMargin = height <= 100 ? 5 : Math.round(height / 100) * 15 + 5;
      plotCss.height = height - dynamicHeightMargin + 'px';
    } else {
      plotCss.height = Math.floor(height * 0.25) + 'px';
    }
    return <div style={plotCss} ref={element => (this.canvasElement = element)} />;
  }

  render() {
    const { height, width, value, prefix, suffix, sparkline, backgroundColor, onClick, className } = this.props;
    const styles = getStyles();
    return (
      <div className={cx(styles.wrapper, className)} style={{ width, height, backgroundColor }} onClick={onClick}>
        {value.title && <div className={styles.title}>{value.title}</div>}

        <span className={styles.value}>
          {this.renderText(prefix, '0px 2px 0px 0px')}
          {this.renderText(value)}
          {this.renderText(suffix)}
        </span>

        {sparkline && this.renderSparkline(sparkline)}
      </div>
    );
  }
}
