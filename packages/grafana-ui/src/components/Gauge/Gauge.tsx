import React, { PureComponent, useRef, useContext } from 'react';
import $ from 'jquery';
import { Threshold, DisplayValue, LinkModelSupplier } from '@grafana/data';

import { getColorFromHexRgbOrName } from '../../utils';
import { Themeable } from '../../types';
import { selectThemeVariant, ThemeContext } from '../../themes';
import { WithContextMenu } from '../ContextMenu/WithContextMenu';
import { linkModelToContextMenuItems } from '../../utils/dataLinks';
import useMouseHovered from 'react-use/lib/useMouseHovered';
import useHoverDirty from 'react-use/lib/useHoverDirty';
import { Portal } from '../Portal/Portal';
import { css, cx } from 'emotion';

const DataLinkCursor = () => {
  const theme = useContext(ThemeContext);
  return (
    <i
      className={cx(
        'fa',
        'fa-link',
        css`
          opacity: 0.7;
          width: 18px;
          height: 18px;
          display: inline-block;
          margin-right: 10px;
          font-size: 16px;
          color: ${selectThemeVariant({ light: theme.colors.dark1, dark: theme.colors.gray5 }, theme.type)};
          position: relative;
          top: 4px;
        `
      )}
    />
  );
};

interface MouseCursorRenderedProps {
  children: (props: { ref: any }) => JSX.Element;
  cursor: JSX.Element;
}

const CustomCursor = ({ x, y, cursor }: { x: number; y: number; cursor: JSX.Element }) => {
  return (
    <div
      className={css`
        width: 18px;
        height: 18px;
        position: fixed;
      `}
      style={{
        top: `${y - 10}px`,
        left: `${x + 10}px`,
      }}
    >
      {cursor}
    </div>
  );
};

const MouseCursorAddon = ({ children, cursor }: MouseCursorRenderedProps) => {
  const elRef = useRef(null);
  const { docX, docY } = useMouseHovered(elRef, {
    bound: true,
    whenHovered: true,
  });
  const hovered = useHoverDirty(elRef);

  return (
    <>
      {children({ ref: elRef })}
      {hovered && (
        <Portal>
          <CustomCursor x={docX} y={docY} cursor={cursor} />
        </Portal>
      )}
    </>
  );
};

export interface Props extends Themeable {
  height: number;
  maxValue: number;
  minValue: number;
  thresholds: Threshold[];
  showThresholdMarkers: boolean;
  showThresholdLabels: boolean;
  width: number;
  value: DisplayValue;
  links?: LinkModelSupplier; // only exists if Links Exist
}

const FONT_SCALE = 1;

export class Gauge extends PureComponent<Props> {
  canvasElement: any;

  static defaultProps: Partial<Props> = {
    maxValue: 100,
    minValue: 0,
    showThresholdMarkers: true,
    showThresholdLabels: false,
    thresholds: [],
  };

  componentDidMount() {
    this.draw();
  }

  componentDidUpdate() {
    this.draw();
  }

  getFormattedThresholds() {
    const { maxValue, minValue, thresholds, theme } = this.props;

    const lastThreshold = thresholds[thresholds.length - 1];

    return [
      ...thresholds.map((threshold, index) => {
        if (index === 0) {
          return { value: minValue, color: getColorFromHexRgbOrName(threshold.color, theme.type) };
        }

        const previousThreshold = thresholds[index - 1];
        return { value: threshold.value, color: getColorFromHexRgbOrName(previousThreshold.color, theme.type) };
      }),
      { value: maxValue, color: getColorFromHexRgbOrName(lastThreshold.color, theme.type) },
    ];
  }

  getFontScale(length: number): number {
    if (length > 12) {
      return FONT_SCALE - (length * 5) / 110;
    }
    return FONT_SCALE - (length * 5) / 101;
  }

  draw() {
    const { maxValue, minValue, showThresholdLabels, showThresholdMarkers, width, height, theme, value } = this.props;

    const autoProps = calculateGaugeAutoProps(width, height, value.title);
    const dimension = Math.min(width, autoProps.gaugeHeight);

    const backgroundColor = selectThemeVariant(
      {
        dark: theme.colors.dark8,
        light: theme.colors.gray6,
      },
      theme.type
    );

    const gaugeWidthReduceRatio = showThresholdLabels ? 1.5 : 1;
    const gaugeWidth = Math.min(dimension / 5.5, 40) / gaugeWidthReduceRatio;
    const thresholdMarkersWidth = gaugeWidth / 5;
    const fontSize = Math.min(dimension / 4, 100) * (value.text !== null ? this.getFontScale(value.text.length) : 1);

    const thresholdLabelFontSize = fontSize / 2.5;

    const options: any = {
      series: {
        gauges: {
          gauge: {
            min: minValue,
            max: maxValue,
            background: { color: backgroundColor },
            border: { color: null },
            shadow: { show: false },
            width: gaugeWidth,
          },
          frame: { show: false },
          label: { show: false },
          layout: { margin: 0, thresholdWidth: 0, vMargin: 0 },
          cell: { border: { width: 0 } },
          threshold: {
            values: this.getFormattedThresholds(),
            label: {
              show: showThresholdLabels,
              margin: thresholdMarkersWidth + 1,
              font: { size: thresholdLabelFontSize },
            },
            show: showThresholdMarkers,
            width: thresholdMarkersWidth,
          },
          value: {
            color: value.color,
            formatter: () => {
              return value.text;
            },
            font: { size: fontSize, family: theme.typography.fontFamily.sansSerif },
          },
          show: true,
        },
      },
    };

    const plotSeries = {
      data: [[0, value.numeric]],
      label: value.title,
    };

    try {
      $.plot(this.canvasElement, [plotSeries], options);
    } catch (err) {
      console.log('Gauge rendering error', err, options, value);
    }
  }

  getDataLinksContextMenuItems = () => {
    const { links } = this.props;
    if (!links) {
      return [];
    }
    return [{ items: linkModelToContextMenuItems(links), label: 'Data links' }];
  };

  renderVisualization = (onClick?: React.MouseEventHandler<HTMLElement>, hasLinks?: boolean) => {
    const { width, value, height } = this.props;
    const autoProps = calculateGaugeAutoProps(width, height, value.title);

    const visualization = (
      <>
        <div
          style={{ height: `${autoProps.gaugeHeight}px`, width: '100%' }}
          ref={element => (this.canvasElement = element)}
        />
        {autoProps.showLabel && (
          <div
            style={{
              textAlign: 'center',
              fontSize: autoProps.titleFontSize,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              position: 'relative',
              width: '100%',
              top: '-4px',
              cursor: 'default',
            }}
          >
            {value.title}
          </div>
        )}
      </>
    );

    return hasLinks ? (
      <MouseCursorAddon cursor={<DataLinkCursor />}>
        {({ ref }) => {
          return (
            <div onClick={onClick} ref={ref}>
              {visualization}
            </div>
          );
        }}
      </MouseCursorAddon>
    ) : (
      <div onClick={onClick}>{visualization}</div>
    );
  };

  render() {
    const { links } = this.props;

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {links ? (
          <WithContextMenu getContextMenuItems={this.getDataLinksContextMenuItems}>
            {({ openMenu }) => this.renderVisualization(openMenu, true)}
          </WithContextMenu>
        ) : (
          this.renderVisualization()
        )}
      </div>
    );
  }
}

interface GaugeAutoProps {
  titleFontSize: number;
  gaugeHeight: number;
  showLabel: boolean;
}

function calculateGaugeAutoProps(width: number, height: number, title: string | undefined): GaugeAutoProps {
  const showLabel = title !== null && title !== undefined;
  const titleFontSize = Math.min((width * 0.15) / 1.5, 20); // 20% of height * line-height, max 40px
  const titleHeight = titleFontSize * 1.5;
  const availableHeight = showLabel ? height - titleHeight : height;
  const gaugeHeight = Math.min(availableHeight, width);

  return {
    showLabel,
    gaugeHeight,
    titleFontSize,
  };
}
