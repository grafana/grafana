//import { ArrayVector, DataFrame } from '@grafana/data';
import { HeatmapHoverProps, HeatmapLayerHover } from '../types';

export const ExemplarTab = ({ data }: HeatmapHoverProps): HeatmapLayerHover => {
  // if (!heatmapData?.heatmap) {
  //   return {
  //     name: 'Exemplar',
  //     data: [],
  //   };
  // }
  // const [ xField, yField, countField ] = getHeatmapFrames(heatmapData?.heatmap!);
  // if (xField && yField && countField && index >= 0) {
  //   const xMin: number = xField.values.get(index);
  //   const xMax: number = xMin + heatmapData.xBucketSize!;
  //   const yMin: number = yField.values.get(index);
  //   const yMax: number = yMin + heatmapData.yBucketSize!;
  //   const count: number = countField.values.get(index);

  //   if (count === 0) {
  //     return {
  //       name: 'Exemplar',
  //       data: [],
  //     };
  //   }

  //   const exemplarData: DataFrame[] | undefined = getValuesInCell!({
  //     frameIndex: 0,
  //     fieldIndex: index,
  //   });

  //   if (exemplarData) {
  //     return {
  //       name: 'Exemplar',
  //       data: exemplarData,
  //     };
  //   }

  //   return {
  //     name: 'Exemplar',
  //     data: [
  //       {
  //         fields: [
  //           {
  //             ...xField,
  //             config: {
  //               ...xField.config,
  //               displayNameFromDS: 'xMin',
  //             },
  //             state: {
  //               ...xField.state,
  //               displayName: 'xMin',
  //             },
  //             values: new ArrayVector([xMin]),
  //           },
  //           {
  //             ...xField,
  //             config: {
  //               ...xField.config,
  //               displayNameFromDS: 'xMax',
  //             },
  //             state: {
  //               ...xField.state,
  //               displayName: 'xMax',
  //             },
  //             values: new ArrayVector([xMax]),
  //           },
  //           {
  //             ...yField,
  //             config: {
  //               ...yField.config,
  //               displayNameFromDS: 'yMin',
  //             },
  //             state: {
  //               ...yField.state,
  //               displayName: 'yMin',
  //             },
  //             values: new ArrayVector([yMin]),
  //           },
  //           {
  //             ...yField,
  //             config: {
  //               ...yField.config,
  //               displayNameFromDS: 'yMax',
  //             },
  //             state: {
  //               ...yField.state,
  //               displayName: 'yMax',
  //             },
  //             values: new ArrayVector([yMax]),
  //           },
  //           {
  //             ...countField,
  //             values: new ArrayVector([]),
  //           },
  //         ],
  //         length: 5,
  //       },
  //     ],
  //   };
  //   return {
  //     name: 'Exemplar',
  //     data: [],
  //   };
  // }

  return {
    name: 'Exemplar',
    data,
  };
};
