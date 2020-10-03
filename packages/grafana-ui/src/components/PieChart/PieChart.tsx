import React, { FC } from 'react';
import { DisplayValue, formattedValueToString, getColorFromHexRgbOrName, GrafanaTheme } from '@grafana/data';
import { useStyles, useTheme } from '../../themes/ThemeContext';
import tinycolor from 'tinycolor2';
import Pie, { PieArcDatum } from '@visx/shape/lib/shapes/Pie';
import { Group } from '@visx/group';
import { RadialGradient } from '@visx/gradient';
import { localPoint } from '@visx/event';
import { useTooltip, useTooltipInPortal } from '@visx/tooltip';
import { useComponentInstanceId } from '../../utils/useComponetInstanceId';
import { css } from 'emotion';

export enum PieChartType {
  Pie = 'pie',
  Donut = 'donut',
}

export enum PieChartLabelOption {
  None = 'none',
  Name = 'name',
  Value = 'value',
  Percent = 'percent',
}

export interface Props {
  height: number;
  width: number;
  values: DisplayValue[];
  pieType: PieChartType;
  label?: PieChartLabelOption;
}

export const PieChart: FC<Props> = ({ values, pieType, width, height, label = PieChartLabelOption.Percent }) => {
  const theme = useTheme();
  const componentInstanceId = useComponentInstanceId('PieChart');
  const styles = useStyles(getStyles);
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<DisplayValue>();
  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true,
  });

  if (values.length < 0) {
    return <div>No data</div>;
  }

  const getValue = (d: DisplayValue) => d.numeric;
  const getGradientId = (idx: number) => `${componentInstanceId}-${idx}`;

  const margin = 16;
  const colors = ['blue', 'green', 'red', 'purple', 'orange'].map(c => getColorFromHexRgbOrName(c, theme.type));
  const size = Math.min(width, height);
  const outerRadius = (size - margin * 2) / 2;
  const donutThickness = pieType === PieChartType.Pie ? outerRadius : Math.max(outerRadius / 3, 20);
  const innerRadius = outerRadius - donutThickness;
  const centerOffset = (size - margin * 2) / 2;

  // for non donut pie charts shift label out a bit
  const labelRadius = innerRadius === 0 ? outerRadius / 6 : innerRadius;
  const gradientFromOffset = 1 - (outerRadius - innerRadius) / outerRadius;

  const getColor = (arc: PieArcDatum<DisplayValue>) => `url(#${getGradientId(arc.index)})`;
  const getKey = (arc: PieArcDatum<DisplayValue>) => arc.data.title ?? 'no title';

  const onMouseMoveOverArc = (event: any, datum: any) => {
    const coords = localPoint(event.target.ownerSVGElement, event);
    showTooltip({
      tooltipLeft: coords!.x,
      tooltipTop: coords!.y,
      tooltipData: datum,
    });
  };

  return (
    <div className={styles.container}>
      <svg width={size} height={size} ref={containerRef}>
        <Group top={centerOffset + margin} left={centerOffset + margin}>
          {colors.map((color, idx) => (
            <RadialGradient
              key={idx}
              id={getGradientId(idx)}
              from={getGradientColorFrom(color, theme)}
              to={getGradientColorTo(color, theme)}
              fromOffset={gradientFromOffset}
              toOffset="1"
              gradientUnits="userSpaceOnUse"
              cx={0}
              cy={0}
              radius={outerRadius}
            />
          ))}
          <Pie
            data={values}
            pieValue={getValue}
            outerRadius={outerRadius}
            innerRadius={innerRadius}
            cornerRadius={3}
            padAngle={0.005}
          >
            {pie => {
              return pie.arcs.map(arc => {
                const [labelX, labelY] = getLabelPos(arc, outerRadius, labelRadius);
                const hasSpaceForLabel = arc.endAngle - arc.startAngle >= 0.4;

                return (
                  <g
                    key={getKey(arc)}
                    className={styles.svgArg}
                    onMouseMove={event => onMouseMoveOverArc(event, arc.data)}
                    onMouseOut={hideTooltip}
                  >
                    <path
                      d={pie.path({ ...arc })!}
                      fill={getColor(arc)}
                      stroke={theme.colors.panelBg}
                      strokeWidth={1}
                    />
                    {hasSpaceForLabel && (
                      <g>
                        <text
                          fill="white"
                          x={labelX}
                          y={labelY}
                          dy=".33em"
                          fontSize={14}
                          textAnchor="middle"
                          pointerEvents="none"
                        >
                          {getKey(arc)}
                        </text>
                      </g>
                    )}
                  </g>
                );
              });
            }}
          </Pie>
        </Group>
      </svg>
      {tooltipOpen && (
        <TooltipInPortal key={Math.random()} top={tooltipTop} left={tooltipLeft}>
          {tooltipData!.title} {formattedValueToString(tooltipData!)}
        </TooltipInPortal>
      )}
    </div>
  );
};

function getLabelPos(arc: PieArcDatum<DisplayValue>, outerRadius: number, innerRadius: number) {
  const r = (outerRadius + innerRadius) / 2;
  const a = (+arc.startAngle + +arc.endAngle) / 2 - Math.PI / 2;
  return [Math.cos(a) * r, Math.sin(a) * r];
}

function getGradientColorFrom(color: string, theme: GrafanaTheme) {
  return tinycolor(color)
    .darken(20 * (theme.isDark ? 1 : -0.7))
    .spin(8)
    .toRgbString();
}

function getGradientColorTo(color: string, theme: GrafanaTheme) {
  return tinycolor(color)
    .darken(10 * (theme.isDark ? 1 : -0.7))
    .spin(-8)
    .toRgbString();
}

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    svgArg: css`
      transition: all 200ms ease-in-out;
      &:hover {
        transform: scale3d(1.03, 1.03, 1);
      }
    `,
  };
};
