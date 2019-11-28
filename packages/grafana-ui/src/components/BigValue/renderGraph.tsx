import React, { CSSProperties } from 'react';
import tinycolor from 'tinycolor2';

import { Chart, Geom } from 'bizcharts';
import { LayoutResult, LayoutType } from './styles';
import { BigValueSparkline, BigValueColorMode, BigValueGraphMode } from './BigValue';

export function renderGraph(layout: LayoutResult, sparkline?: BigValueSparkline) {
  if (!sparkline || layout.type === LayoutType.WideNoChart || layout.type === LayoutType.StackedNoChart) {
    return null;
  }

  const data = sparkline.data.map(values => {
    return { time: values[0], value: values[1], name: 'A' };
  });

  const scales = {
    time: {
      type: 'time',
    },
  };

  const chartStyles: CSSProperties = {
    position: 'absolute',
  };

  // default to line graph
  const geomRender = getGraphGeom(layout.colorMode, layout.graphMode);

  if (layout.type === LayoutType.Wide) {
    if (layout.graphMode === BigValueGraphMode.Line) {
      // need some top padding
      layout.chartHeight -= 8;
      chartStyles.width = `${layout.chartWidth}px`;
      chartStyles.height = `${layout.chartHeight}px`;
      chartStyles.bottom = '8px';
      chartStyles.right = '8px';
    } else {
      // Area chart
      chartStyles.width = `${layout.chartWidth}px`;
      chartStyles.height = `${layout.chartHeight}px`;
      chartStyles.bottom = 0;
      chartStyles.right = 0;
      chartStyles.top = 0;
    }
  } else {
    // Stacked mode
    if (layout.graphMode === BigValueGraphMode.Line) {
      // need some top padding
      layout.chartHeight -= 8;
      chartStyles.width = `${layout.chartWidth}px`;
      chartStyles.height = `${layout.chartHeight}px`;
      chartStyles.bottom = '8px';
    } else {
      // need some top padding
      layout.chartHeight -= 8;
      chartStyles.width = `${layout.chartWidth}px`;
      chartStyles.height = `${layout.chartHeight}px`;
      chartStyles.bottom = 0;
      chartStyles.right = 0;
      chartStyles.left = 0;
      chartStyles.right = 0;
    }
  }

  return (
    <Chart
      height={layout.chartHeight}
      width={layout.chartWidth}
      data={data}
      animate={false}
      padding={[4, 0, 0, 0]}
      scale={scales}
      style={chartStyles}
    >
      {geomRender(layout)}
    </Chart>
  );
}
function getGraphGeom(colorMode: BigValueColorMode, graphMode: BigValueGraphMode) {
  // background color mode
  if (colorMode === BigValueColorMode.Background) {
    if (graphMode === BigValueGraphMode.Line) {
      return renderLineGeom;
    }
    if (graphMode === BigValueGraphMode.Area) {
      return renderAreaGeomOnColoredBackground;
    }
  }
  return renderClassicAreaGeom;
}

function renderLineGeom(layout: LayoutResult) {
  const lineStyle: any = {
    stroke: '#CCC',
    lineWidth: 2,
    shadowBlur: 10,
    shadowColor: '#444',
    shadowOffsetY: 7,
  };
  return <Geom type="line" position="time*value" size={2} color="white" style={lineStyle} shape="smooth" />;
}

function renderAreaGeomOnColoredBackground(layout: LayoutResult) {
  const lineColor = tinycolor(layout.valueColor)
    .brighten(40)
    .toRgbString();
  const lineStyle: any = {
    stroke: lineColor,
    lineWidth: 2,
  };
  return (
    <>
      <Geom type="area" position="time*value" size={0} color="rgba(255,255,255,0.4)" style={lineStyle} shape="smooth" />
      <Geom type="line" position="time*value" size={1} color={lineColor} style={lineStyle} shape="smooth" />
    </>
  );
}

function renderClassicAreaGeom(layout: LayoutResult) {
  const lineStyle: any = {
    opacity: 1,
    fillOpacity: 1,
  };
  const fillColor = tinycolor(layout.valueColor)
    .setAlpha(0.2)
    .toRgbString();
  lineStyle.stroke = layout.valueColor;
  return (
    <>
      <Geom type="area" position="time*value" size={0} color={fillColor} style={lineStyle} shape="smooth" />
      <Geom type="line" position="time*value" size={1} color={layout.valueColor} style={lineStyle} shape="smooth" />
    </>
  );
}

/* function renderAreaGeom(layout: LayoutResult) { */
/*   const lineStyle: any = { */
/*     opacity: 1, */
/*     fillOpacity: 1, */
/*   }; */
/*  */
/*   const color1 = tinycolor(layout.valueColor) */
/*     .darken(0) */
/*     .spin(20) */
/*     .toRgbString(); */
/*   const color2 = tinycolor(layout.valueColor) */
/*     .lighten(0) */
/*     .spin(-20) */
/*     .toRgbString(); */
/*  */
/*   const fillColor = `l (0) 0:${color1} 1:${color2}`; */
/*  */
/*   return <Geom type="area" position="time*value" size={0} color={fillColor} style={lineStyle} shape="smooth" />; */
/* } */
