import React, { FC } from 'react';
import { DisplayValue, formattedValueToString, getColorFromHexRgbOrName, GrafanaTheme } from '@grafana/data';
import { useTheme } from '../../themes/ThemeContext';
import tinycolor from 'tinycolor2';
import Pie, { PieArcDatum } from '@visx/shape/lib/shapes/Pie';
import { Group } from '@visx/group';
import { RadialGradient } from '@visx/gradient';
import { useComponentInstanceId } from '../../utils/useComponetInstanceId';

export enum PieChartType {
  Pie = 'pie',
  Donut = 'donut',
}

export interface Props {
  height: number;
  width: number;
  values: DisplayValue[];
  pieType: PieChartType;
}

export const PieChart: FC<Props> = ({ values, pieType, width, height }) => {
  const theme = useTheme();
  const componentInstanceId = useComponentInstanceId('PieChart');

  if (values.length < 0) {
    return <div>No data</div>;
  }

  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const getValue = (d: DisplayValue) => d.numeric;
  const getGradientId = (idx: number) => `${componentInstanceId}-${idx}`;

  const colors = ['blue', 'green', 'red', 'purple', 'orange'].map(c => getColorFromHexRgbOrName(c, theme.type));
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const radius = Math.min(innerWidth, innerHeight) / 2;
  const centerY = innerHeight / 2;
  const centerX = innerWidth / 2;
  const donutThickness = pieType === PieChartType.Pie ? radius : 60;
  const getColor = (arc: PieArcDatum<DisplayValue>) => `url(#${getGradientId(arc.index)})`;
  const getKey = (arc: PieArcDatum<DisplayValue>) => arc.data.title ?? 'no title';

  return (
    <svg width={width} height={height}>
      {colors.map((color, idx) => (
        <RadialGradient
          key={idx}
          id={getGradientId(idx)}
          from={getGradientColorFrom(color, theme)}
          to={getGradientColorTo(color, theme)}
          fromOffset="0"
          toOffset="1"
          gradientUnits="userSpaceOnUse"
          cx="0"
          cy="0"
          radius={radius}
        />
      ))}
      <Group top={centerY + margin.top} left={centerX + margin.left}>
        <Pie
          data={values}
          pieValue={getValue}
          outerRadius={radius}
          innerRadius={radius - donutThickness}
          cornerRadius={3}
          padAngle={0.005}
        >
          {pie => {
            return pie.arcs.map(arc => {
              const [centroidX, centroidY] = pie.path.centroid(arc);
              const hasSpaceForLabel = arc.endAngle - arc.startAngle >= 0.4;

              return (
                <g key={getKey(arc)}>
                  <path
                    d={pie.path({ ...arc })!}
                    fill={getColor(arc)}
                    stroke={theme.colors.panelBg}
                    strokeWidth={1}
                    //onClick={() => onClickDatum(arc)}
                    //onTouchStart={() => onClickDatum(arc)}
                  />
                  {hasSpaceForLabel && (
                    <g>
                      <text
                        fill="white"
                        x={centroidX}
                        y={centroidY}
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
  );
};

function getGradientColorFrom(color: string, theme: GrafanaTheme) {
  return tinycolor(color)
    .darken(15 * (theme.isDark ? 1 : -0.7))
    .spin(8)
    .toRgbString();
}

function getGradientColorTo(color: string, theme: GrafanaTheme) {
  return tinycolor(color)
    .darken(5 * (theme.isDark ? 1 : -0.7))
    .spin(-8)
    .toRgbString();
}
