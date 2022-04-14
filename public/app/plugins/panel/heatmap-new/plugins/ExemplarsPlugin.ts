import { DataFrame, TimeZone, Field } from '@grafana/data';
import { UPlotConfigBuilder } from '@grafana/ui';
// import { ExemplarMarker } from './ExemplarMarker';
import uPlot from 'uplot';
import { HeatmapData } from '../fields';
import { HeatmapLookup } from '../types';

interface ExemplarsPluginProps {
  u: uPlot;
  config: UPlotConfigBuilder;
  exemplars: HeatmapData;
  colorPalette: string[];
  timeZone: TimeZone;
  getValuesInCell: (lookupRange: HeatmapLookup) => DataFrame[] | undefined;
}

// const getStyles = (theme: GrafanaTheme) => {
//   return theme;
// }

export const ExemplarsPlugin = ({
  u,
  exemplars,
  timeZone,
  getValuesInCell,
  config,
  colorPalette,
}: ExemplarsPluginProps) => {
  // const styles = useStyles(getStyles);
  const { ctx } = u;
  const xField: Field | undefined = exemplars?.heatmap?.fields.find((f) => f.name === 'xMin');
  const yField: Field | undefined = exemplars?.heatmap?.fields.find((f) => f.name === 'yMin');
  const countField: Field | undefined = exemplars?.heatmap?.fields.find((f) => f.name === 'count');

  if (xField && yField && countField) {
    // const yScale = Object.keys(ctx.scale).find((scale) => 'y' === scale) ?? FIXED_UNIT;
    // const xScale = Object.keys(ctx.scale).find((scale) => 'x' === scale) ?? FIXED_UNIT;
    // const yEnd = ctx.scale[yScale].max;
    // const yStart = ctx.scales[yScale].min;
    // const xEnd = ctx.scales[xScale].max;
    // const xStart = ctx.scales[xScale].min;
    const countArray = countField.values.toArray();
    const max = Math.max(...countArray);
    const colorBinSize = colorPalette.length / max;
    console.log('colorBinSize', colorBinSize);
    countField.values.toArray().forEach((count, i) => {
      const xVal = xField.values.get(i);
      const yVal = yField.values.get(i);
      // const row = Math.floor(i / exemplars?.yBucketCount!);
      //const column = i % exemplars?.yBucketCount!;
      // const xRangeMin = xStart! + (row * exemplars?.xBucketSize!);
      // const xRangeMax = xRangeMin + exemplars?.xBucketSize!;
      // // if (xVal < xRangeMin || xVal > xRangeMax) {
      //   console.log("row", row, "xRangeMin", xRangeMin, "xRangeMax", xRangeMax, "xVal", xVal);
      //   return;
      // }
      if (count > 0) {
        let x = Math.round(u.valToPos(xVal! + exemplars.xBucketSize!, 'x', true));
        let y = Math.round(u.valToPos(yVal + exemplars.yBucketSize!, 'y', true));
        ctx.beginPath();
        ctx.moveTo(x - 12, y + 3);
        ctx.lineTo(x - 2, y + 3);
        ctx.lineTo(x - 2, y + 13);
        ctx.lineTo(x - 12, y + 3);
        ctx.fill();
        ctx.stroke();
        // ctx.strokeStyle = styles.palette.dark1;
        ctx.fillStyle = colorPalette[Math.floor(colorBinSize * count - colorBinSize / 2)];
        console.log('count', count, 'colorIndex', Math.floor(colorBinSize * count - colorBinSize / 2));
      }
      ctx.save();
    });
  }
};

// const mapExemplarToXYCoords = useCallback(
//   (dataFrame: DataFrame, dataFrameFieldIndex: DataFrameFieldIndex) => {
//     const xMin = dataFrame.fields.find((f) => f.name === 'xMin');
//     const yMin = dataFrame.fields.find((f) => f.name === 'yMin');
//     const count = dataFrame.fields.find((f) => f.name === 'count');

//     if (!xMin || !yMin || !count || !plotInstance.current) {
//       return undefined;
//     }

//     // Don't render a merker if the count is zero
//     if (!count.values.get(dataFrameFieldIndex.fieldIndex)) {
//       return undefined;
//     }

//     // Filter x, y scales out
//     const yScale = Object.keys(plotInstance.current.scales).find((scale) => 'y' === scale) ?? FIXED_UNIT;
//     const xScale = Object.keys(plotInstance.current.scales).find((scale) => 'x' === scale) ?? FIXED_UNIT;
//     const yEnd = plotInstance.current.scales[yScale].max;
//     const yStart = plotInstance.current.scales[yScale].min;
//     const xEnd = plotInstance.current.scales[xScale].max;
//     const xStart = plotInstance.current.scales[xScale].min;

//     if (
//       xStart != null &&
//       xEnd != null &&
//       yStart != null &&
//       yEnd != null &&
//       exemplars.xBucketSize &&
//       exemplars.yBucketSize
//     ) {
//       let x = xMin.values.get(dataFrameFieldIndex.fieldIndex) + exemplars.xBucketSize / 2;
//       let y = yMin.values.get(dataFrameFieldIndex.fieldIndex) + exemplars.yBucketSize / 2;

//       if (x < xStart || x > xEnd) {
//         return undefined;
//       }

//       if (y < yStart || y > yEnd) {
//         return undefined;
//       }

//       return {
//         x: Math.round(plotInstance.current.valToPos(x, 'x')),
//         y: Math.round(plotInstance.current.valToPos(y, 'y')),
//       };
//     }

//     return undefined;
//   },
//   [exemplars]
// );

// const renderMarker = useCallback(
//   (dataFrame: DataFrame, dataFrameFieldIndex: DataFrameFieldIndex) => {
//     const xMin: number | undefined = dataFrame.fields
//       .find((f) => f.name === 'xMin')
//       ?.values.get(dataFrameFieldIndex.fieldIndex);
//     const yMin: number | undefined = dataFrame.fields
//       .find((f) => f.name === 'yMin')
//       ?.values.get(dataFrameFieldIndex.fieldIndex);
//     const count: number | undefined = dataFrame.fields
//       .find((f) => f.name === 'count')
//       ?.values.get(dataFrameFieldIndex.fieldIndex);
//     return (
//       xMin != null &&
//       yMin != null &&
//       count != null &&
//       exemplars.xBucketSize != null &&
//       exemplars.yBucketSize != null && (
//         <ExemplarMarker
//           timeZone={timeZone}
//           getValuesInCell={getValuesInCell}
//           lookupRange={{
//             xRange: {
//               min: xMin,
//               max: xMin + exemplars.xBucketSize,
//               delta: exemplars.xBucketSize || 0,
//             },
//             yRange: {
//               min: yMin,
//               max: yMin + exemplars.yBucketSize,
//               delta: exemplars.yBucketSize || 0,
//             },
//             count,
//           }}
//           config={config}
//         />
//       )
//     );
//   },
//   [config, timeZone, getValuesInCell, exemplars]
// );

// return (
//   <EventsCanvas
//     config={config}
//     id="heatmap-exemplars"
//     events={[exemplars.heatmap!]}
//     renderEventMarker={renderMarker}
//     mapEventToXYCoords={mapExemplarToXYCoords}
//   />
// );
