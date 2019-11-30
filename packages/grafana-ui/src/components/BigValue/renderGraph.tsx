import React, { CSSProperties } from 'react';
import tinycolor from 'tinycolor2';

import { Chart, Geom, Guide } from 'bizcharts';
import { LayoutResult, LayoutType } from './styles';
import { BigValueSparkline, BigValueColorMode } from './BigValue';

const { DataMarker } = Guide;

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
  const geomRender = getGraphGeom(layout.colorMode);

  if (layout.type === LayoutType.Wide) {
    // Area chart
    chartStyles.bottom = 0;
    chartStyles.right = 0;
  } else {
    // need some top padding
    chartStyles.width = `${layout.chartWidth}px`;
    chartStyles.height = `${layout.chartHeight}px`;
    chartStyles.bottom = 0;
    chartStyles.right = 0;
    chartStyles.left = 0;
    chartStyles.right = 0;
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
      {geomRender(layout, sparkline)}
    </Chart>
  );
}
function getGraphGeom(colorMode: BigValueColorMode) {
  // background color mode
  if (colorMode === BigValueColorMode.Background) {
    return renderAreaGeomOnColoredBackground;
  }
  return renderClassicAreaGeom;
}

function renderAreaGeomOnColoredBackground(layout: LayoutResult, sparkline: BigValueSparkline) {
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
      {highlightPoint(lineColor, sparkline)}
    </>
  );
}

function highlightPoint(lineColor: string, sparkline: BigValueSparkline) {
  if (!sparkline.highlightIndex) {
    return null;
  }

  const pointPos = sparkline.data[sparkline.highlightIndex];

  return (
    <Guide>
      <DataMarker
        top
        position={pointPos}
        lineLength={0}
        display={{ point: true }}
        style={{
          point: {
            color: lineColor,
            stroke: lineColor,
            r: 2,
          },
        }}
      />
    </Guide>
  );
}

function renderClassicAreaGeom(layout: LayoutResult, sparkline: BigValueSparkline) {
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
      {highlightPoint('#EEE', sparkline)}
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
