import React, { FC, ReactNode } from 'react';
import { DisplayValue, FALLBACK_COLOR, FieldDisplay, formattedValueToString, GrafanaTheme } from '@grafana/data';
import { useStyles, useTheme } from '../../themes/ThemeContext';
import tinycolor from 'tinycolor2';
import Pie, { PieArcDatum, ProvidedProps } from '@visx/shape/lib/shapes/Pie';
import { Group } from '@visx/group';
import { RadialGradient } from '@visx/gradient';
import { localPoint } from '@visx/event';
import { useTooltip, useTooltipInPortal } from '@visx/tooltip';
import { useComponentInstanceId } from '../../utils/useComponetInstanceId';
import { css } from '@emotion/css';
import { VizLegend, VizLegendItem } from '..';
import { VizLayout } from '../VizLayout/VizLayout';
import { LegendDisplayMode, VizLegendOptions } from '../VizLegend/models.gen';
import { DataLinksContextMenu } from '../DataLinks/DataLinksContextMenu';
import { UseTooltipParams } from '@visx/tooltip/lib/hooks/useTooltip';

export enum PieChartLabels {
  Name = 'name',
  Value = 'value',
  Percent = 'percent',
}

export enum PieChartLegendValues {
  Value = 'value',
  Percent = 'percent',
}

interface SvgProps {
  height: number;
  width: number;
  fieldDisplayValues: FieldDisplay[];
  pieType: PieChartType;
  displayLabels?: PieChartLabels[];
  useGradients?: boolean;
  onSeriesColorChange?: (label: string, color: string) => void;
}
export interface Props extends SvgProps {
  legendOptions?: PieChartLegendOptions;
}

export enum PieChartType {
  Pie = 'pie',
  Donut = 'donut',
}

export interface PieChartLegendOptions extends VizLegendOptions {
  values: PieChartLegendValues[];
}

const defaultLegendOptions: PieChartLegendOptions = {
  displayMode: LegendDisplayMode.List,
  placement: 'right',
  calcs: [],
  values: [PieChartLegendValues.Percent],
};

export const PieChart: FC<Props> = ({
  fieldDisplayValues,
  legendOptions = defaultLegendOptions,
  onSeriesColorChange,
  width,
  height,
  ...restProps
}) => {
  const getLegend = (fields: FieldDisplay[], legendOptions: PieChartLegendOptions) => {
    if (legendOptions.displayMode === LegendDisplayMode.Hidden) {
      return undefined;
    }
    const values = fields.map((v) => v.display);
    const total = values.reduce((acc, item) => item.numeric + acc, 0);

    const legendItems = values.map<VizLegendItem>((value, idx) => {
      return {
        label: value.title ?? '',
        color: value.color ?? FALLBACK_COLOR,
        yAxis: 1,
        getItemKey: () => (value.title ?? '') + idx,
        getDisplayValues: () => {
          const valuesToShow = legendOptions.values ?? [];
          let displayValues = [];

          if (valuesToShow.includes(PieChartLegendValues.Value)) {
            displayValues.push({ numeric: value.numeric, text: formattedValueToString(value), title: 'Value' });
          }

          if (valuesToShow.includes(PieChartLegendValues.Percent)) {
            const fractionOfTotal = value.numeric / total;
            const percentOfTotal = fractionOfTotal * 100;

            displayValues.push({
              numeric: fractionOfTotal,
              percent: percentOfTotal,
              text: percentOfTotal.toFixed(0) + '%',
              title: valuesToShow.length > 1 ? 'Percent' : undefined,
            });
          }

          return displayValues;
        },
      };
    });

    return (
      <VizLegend
        items={legendItems}
        onSeriesColorChange={onSeriesColorChange}
        placement={legendOptions.placement}
        displayMode={legendOptions.displayMode}
      />
    );
  };

  return (
    <VizLayout width={width} height={height} legend={getLegend(fieldDisplayValues, legendOptions)}>
      {(vizWidth: number, vizHeight: number) => {
        return (
          <PieChartSvg width={vizWidth} height={vizHeight} fieldDisplayValues={fieldDisplayValues} {...restProps} />
        );
      }}
    </VizLayout>
  );
};

export const PieChartSvg: FC<SvgProps> = ({
  fieldDisplayValues,
  pieType,
  width,
  height,
  useGradients = true,
  displayLabels = [],
}) => {
  const theme = useTheme();
  const componentInstanceId = useComponentInstanceId('PieChart');
  const styles = useStyles(getStyles);
  const tooltip = useTooltip<DisplayValue>();
  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true,
  });

  if (fieldDisplayValues.length < 0) {
    return <div>No data</div>;
  }

  const getValue = (d: FieldDisplay) => d.display.numeric;
  const getGradientId = (color: string) => `${componentInstanceId}-${tinycolor(color).toHex()}`;
  const getGradientColor = (color: string) => {
    return `url(#${getGradientId(color)})`;
  };

  const showLabel = displayLabels.length > 0;
  const total = fieldDisplayValues.reduce((acc, item) => item.display.numeric + acc, 0);
  const layout = getPieLayout(width, height, pieType);
  const colors = [
    ...new Set(fieldDisplayValues.map((fieldDisplayValue) => fieldDisplayValue.display.color ?? FALLBACK_COLOR)),
  ];

  return (
    <div className={styles.container}>
      <svg width={layout.size} height={layout.size} ref={containerRef}>
        <Group top={layout.position} left={layout.position}>
          {colors.map((color) => {
            return (
              <RadialGradient
                key={color}
                id={getGradientId(color)}
                from={getGradientColorFrom(color, theme)}
                to={getGradientColorTo(color, theme)}
                fromOffset={layout.gradientFromOffset}
                toOffset="1"
                gradientUnits="userSpaceOnUse"
                cx={0}
                cy={0}
                radius={layout.outerRadius}
              />
            );
          })}
          <Pie
            data={fieldDisplayValues}
            pieValue={getValue}
            outerRadius={layout.outerRadius}
            innerRadius={layout.innerRadius}
            cornerRadius={3}
            padAngle={0.005}
          >
            {(pie) => {
              return pie.arcs.map((arc) => {
                const color = arc.data.display.color ?? FALLBACK_COLOR;
                const label = showLabel ? (
                  <PieLabel
                    arc={arc}
                    outerRadius={layout.outerRadius}
                    innerRadius={layout.innerRadius}
                    displayLabels={displayLabels}
                    total={total}
                    color={theme.colors.text}
                  />
                ) : undefined;
                if (arc.data.hasLinks && arc.data.getLinks) {
                  return (
                    <DataLinksContextMenu config={arc.data.field} key={arc.index} links={arc.data.getLinks}>
                      {(api) => (
                        <PieSlice
                          tooltip={tooltip}
                          arc={arc}
                          pie={pie}
                          fill={getGradientColor(color)}
                          openMenu={api.openMenu}
                        >
                          {label}
                        </PieSlice>
                      )}
                    </DataLinksContextMenu>
                  );
                } else {
                  return (
                    <PieSlice key={arc.index} tooltip={tooltip} arc={arc} pie={pie} fill={getGradientColor(color)}>
                      {label}
                    </PieSlice>
                  );
                }
              });
            }}
          </Pie>
        </Group>
      </svg>
      {tooltip.tooltipOpen && (
        <TooltipInPortal
          key={Math.random()}
          top={tooltip.tooltipTop}
          className={styles.tooltipPortal}
          left={tooltip.tooltipLeft}
        >
          {tooltip.tooltipData!.title} {formattedValueToString(tooltip.tooltipData!)}
        </TooltipInPortal>
      )}
    </div>
  );
};

const PieSlice: FC<{
  children: ReactNode;
  arc: PieArcDatum<FieldDisplay>;
  pie: ProvidedProps<FieldDisplay>;
  fill: string;
  tooltip: UseTooltipParams<DisplayValue>;
  openMenu?: (event: React.MouseEvent<SVGElement>) => void;
}> = ({ arc, children, pie, openMenu, fill, tooltip }) => {
  const theme = useTheme();
  const styles = useStyles(getStyles);

  const onMouseMoveOverArc = (event: any, datum: any) => {
    const coords = localPoint(event.target.ownerSVGElement, event);
    tooltip.showTooltip({
      tooltipLeft: coords!.x,
      tooltipTop: coords!.y,
      tooltipData: datum,
    });
  };

  return (
    <g
      key={arc.data.display.title}
      className={styles.svgArg}
      onMouseMove={(event) => onMouseMoveOverArc(event, arc.data.display)}
      onMouseOut={tooltip.hideTooltip}
      onClick={openMenu}
    >
      <path d={pie.path({ ...arc })!} fill={fill} stroke={theme.colors.panelBg} strokeWidth={1} />
      {children}
    </g>
  );
};

const PieLabel: FC<{
  arc: PieArcDatum<FieldDisplay>;
  outerRadius: number;
  innerRadius: number;
  displayLabels: PieChartLabels[];
  total: number;
  color: string;
}> = ({ arc, outerRadius, innerRadius, displayLabels, total, color }) => {
  const labelRadius = innerRadius === 0 ? outerRadius / 6 : innerRadius;
  const [labelX, labelY] = getLabelPos(arc, outerRadius, labelRadius);
  const hasSpaceForLabel = arc.endAngle - arc.startAngle >= 0.3;

  if (!hasSpaceForLabel) {
    return null;
  }

  let labelFontSize = displayLabels.includes(PieChartLabels.Name)
    ? Math.min(Math.max((outerRadius / 150) * 14, 12), 30)
    : Math.min(Math.max((outerRadius / 100) * 14, 12), 36);

  return (
    <g>
      <text
        fill={color}
        x={labelX}
        y={labelY}
        dy=".33em"
        fontSize={labelFontSize}
        textAnchor="middle"
        pointerEvents="none"
      >
        {displayLabels.includes(PieChartLabels.Name) && (
          <tspan x={labelX} dy="1.2em">
            {arc.data.display.title}
          </tspan>
        )}
        {displayLabels.includes(PieChartLabels.Value) && (
          <tspan x={labelX} dy="1.2em">
            {formattedValueToString(arc.data.display)}
          </tspan>
        )}
        {displayLabels.includes(PieChartLabels.Percent) && (
          <tspan x={labelX} dy="1.2em">
            {((arc.data.display.numeric / total) * 100).toFixed(0) + '%'}
          </tspan>
        )}
      </text>
    </g>
  );
};

function getLabelPos(arc: PieArcDatum<FieldDisplay>, outerRadius: number, innerRadius: number) {
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

interface PieLayout {
  position: number;
  size: number;
  outerRadius: number;
  innerRadius: number;
  gradientFromOffset: number;
}

function getPieLayout(height: number, width: number, pieType: PieChartType, margin = 16): PieLayout {
  const size = Math.min(width, height);
  const outerRadius = (size - margin * 2) / 2;
  const donutThickness = pieType === PieChartType.Pie ? outerRadius : Math.max(outerRadius / 3, 20);
  const innerRadius = outerRadius - donutThickness;
  const centerOffset = (size - margin * 2) / 2;
  // for non donut pie charts shift gradient out a bit
  const gradientFromOffset = 1 - (outerRadius - innerRadius) / outerRadius;
  return {
    position: centerOffset + margin,
    size: size,
    outerRadius: outerRadius,
    innerRadius: innerRadius,
    gradientFromOffset: gradientFromOffset,
  };
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
    tooltipPortal: css`
      z-index: 1050;
    `,
  };
};
