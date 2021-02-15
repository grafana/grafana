import React, { FC } from 'react';
import { DisplayValue, formattedValueToString, GrafanaTheme } from '@grafana/data';
import { useStyles, useTheme } from '../../themes/ThemeContext';
import tinycolor from 'tinycolor2';
import Pie, { PieArcDatum } from '@visx/shape/lib/shapes/Pie';
import { Group } from '@visx/group';
import { RadialGradient } from '@visx/gradient';
import { localPoint } from '@visx/event';
import { useTooltip, useTooltipInPortal } from '@visx/tooltip';
import { useComponentInstanceId } from '../../utils/useComponetInstanceId';
import { css } from 'emotion';

export interface Props {
  height: number;
  width: number;
  values: DisplayValue[];
  pieType: PieChartType;
  labelOptions?: PieChartLabelOptions;
}

export enum PieChartType {
  Pie = 'pie',
  Donut = 'donut',
}

export interface PieChartLabelOptions {
  showName?: boolean;
  showValue?: boolean;
  showPercent?: boolean;
}

export const PieChart: FC<Props> = ({ values, pieType, width, height, labelOptions = { showName: true } }) => {
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

  const margin = 16;
  const size = Math.min(width, height);
  const outerRadius = (size - margin * 2) / 2;
  const donutThickness = pieType === PieChartType.Pie ? outerRadius : Math.max(outerRadius / 3, 20);
  const innerRadius = outerRadius - donutThickness;
  const centerOffset = (size - margin * 2) / 2;
  const total = values.reduce((acc, item) => item.numeric + acc, 0);
  // for non donut pie charts shift gradient out a bit
  const gradientFromOffset = 1 - (outerRadius - innerRadius) / outerRadius;
  const showLabel = labelOptions.showName || labelOptions.showPercent || labelOptions.showValue;

  const getValue = (d: DisplayValue) => d.numeric;
  const getGradientId = (idx: number) => `${componentInstanceId}-${idx}`;
  const getColor = (arc: PieArcDatum<DisplayValue>) => `url(#${getGradientId(arc.index)})`;

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
          {values.map((value, idx) => {
            const color = value.color ?? 'gray';
            return (
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
            );
          })}
          <Pie
            data={values}
            pieValue={getValue}
            outerRadius={outerRadius}
            innerRadius={innerRadius}
            cornerRadius={3}
            padAngle={0.005}
          >
            {(pie) => {
              return pie.arcs.map((arc) => {
                return (
                  <g
                    key={arc.data.title}
                    className={styles.svgArg}
                    onMouseMove={(event) => onMouseMoveOverArc(event, arc.data)}
                    onMouseOut={hideTooltip}
                  >
                    <path
                      d={pie.path({ ...arc })!}
                      fill={getColor(arc)}
                      stroke={theme.colors.panelBg}
                      strokeWidth={1}
                    />
                    {showLabel && (
                      <PieLabel
                        arc={arc}
                        outerRadius={outerRadius}
                        innerRadius={innerRadius}
                        labelOptions={labelOptions}
                        total={total}
                      />
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

const PieLabel: FC<{
  arc: PieArcDatum<DisplayValue>;
  outerRadius: number;
  innerRadius: number;
  labelOptions: PieChartLabelOptions;
  total: number;
}> = ({ arc, outerRadius, innerRadius, labelOptions, total }) => {
  const labelRadius = innerRadius === 0 ? outerRadius / 6 : innerRadius;
  const [labelX, labelY] = getLabelPos(arc, outerRadius, labelRadius);
  const hasSpaceForLabel = arc.endAngle - arc.startAngle >= 0.3;

  if (!hasSpaceForLabel) {
    return null;
  }

  let labelFontSize = labelOptions.showName
    ? Math.min(Math.max((outerRadius / 150) * 14, 12), 30)
    : Math.min(Math.max((outerRadius / 100) * 14, 12), 36);

  return (
    <g>
      <text
        fill="white"
        x={labelX}
        y={labelY}
        dy=".33em"
        fontSize={labelFontSize}
        textAnchor="middle"
        pointerEvents="none"
      >
        {labelOptions.showName && (
          <tspan x={labelX} dy="1.2em">
            {arc.data.title}
          </tspan>
        )}
        {labelOptions.showValue && (
          <tspan x={labelX} dy="1.2em">
            {formattedValueToString(arc.data)}
          </tspan>
        )}
        {labelOptions.showPercent && (
          <tspan x={labelX} dy="1.2em">
            {((arc.data.numeric / total) * 100).toFixed(0) + '%'}
          </tspan>
        )}
      </text>
    </g>
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
