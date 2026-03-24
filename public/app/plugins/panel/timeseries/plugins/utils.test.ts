import { arrayToDataFrame, createDataFrame, DataFrame, DataTopic, FieldType } from '@grafana/data';

import { AnnotationVals } from './annotations2-cluster/types';
import { ANNOTATION_REGION_MIN_WIDTH, getAnnoRegionStyle, getXAnnotationFrames, getXYAnnotationFrames } from './utils';

const exemplarFrame = createDataFrame({
  refId: 'A',
  name: 'exemplar',
  meta: {
    custom: {
      resultType: 'exemplar',
    },
  },
  fields: [
    { name: 'Time', type: FieldType.time, values: [6, 5, 4, 3, 2, 1] },
    {
      name: 'Value',
      type: FieldType.number,
      values: [30, 10, 40, 90, 14, 21],
      labels: { le: '6' },
    },
    {
      name: 'traceID',
      type: FieldType.string,
      values: ['unknown'],
      labels: { le: '6' },
    },
  ],
});
const annotationRegionFrame: DataFrame = {
  fields: [
    {
      name: 'type',
      config: {
        custom: {},
      },
      values: ['Milestones'],
      type: FieldType.string,
      state: {
        displayName: null,
        seriesIndex: 0,
      },
    },
    {
      name: 'color',
      config: {
        custom: {},
      },
      values: ['#F2495C'],
      type: FieldType.string,
      state: {
        displayName: null,
        seriesIndex: 1,
      },
    },
    {
      name: 'time',
      config: {
        custom: {},
      },
      values: [1720697881000],
      type: FieldType.time,
      state: {
        displayName: null,
        seriesIndex: 2,
      },
    },
    {
      name: 'timeEnd',
      config: {
        custom: {},
      },
      values: [1729081505000],
      type: FieldType.number,
      state: {
        displayName: null,
        seriesIndex: 2,
        range: {
          min: 1729081505000,
          max: 1759857566000,
          delta: 30776061000,
        },
      },
    },
    {
      name: 'title',
      config: {
        custom: {},
      },
      values: ['0.1.0'],
      type: FieldType.string,
      state: {
        displayName: null,
        seriesIndex: 3,
      },
    },
    {
      name: 'text',
      config: {
        custom: {},
      },
      values: [true],
      type: FieldType.boolean,
      state: {
        displayName: null,
        seriesIndex: 4,
      },
    },
    {
      name: 'isRegion',
      config: {
        custom: {},
      },
      values: [true],
      type: FieldType.boolean,
      state: {
        displayName: null,
        seriesIndex: 6,
      },
    },
  ],
  length: 1,
  meta: {
    dataTopic: DataTopic.Annotations,
  },
};
const annotationFrame: DataFrame = {
  ...annotationRegionFrame,
  fields: [...annotationRegionFrame.fields.filter((f) => f.name !== 'timeEnd')],
};
const frames: DataFrame[] = [exemplarFrame, annotationRegionFrame, annotationFrame];
const xymark = arrayToDataFrame([
  {
    time: 0,
    xMin: 0,
    xMax: 0,
    timeEnd: 0,
    yMin: 0,
    yMax: 100,
    isRegion: true,
    fillOpacity: 0.15,
    lineWidth: 1,
    lineStyle: 'solid',
    color: '#FF9930',
    text: 'Comparison selection',
  },
]);
xymark.name = 'xymark';

describe('getXAnnotationFrames', () => {
  it('should filter exemplar frames', () => {
    expect(getXAnnotationFrames(frames)).toEqual([annotationRegionFrame, annotationFrame]);
  });

  it('should exclude xymark frames', () => {
    const framesWithxymark = [...frames, xymark];
    expect(getXAnnotationFrames(framesWithxymark)).toEqual([annotationRegionFrame, annotationFrame]);
  });
});

describe('getXYAnnotationFrames', () => {
  it('should include xymark frames', () => {
    const framesWithxymark = [...frames, xymark];
    expect(getXYAnnotationFrames(framesWithxymark)).toEqual([xymark]);
  });
});

describe('getAnnoRegionStyle', () => {
  it.each([
    {
      name: 'clustered narrow region applies min width and shifts left by half min width',
      plotWidth: 600,
      left: 100,
      right: 102,
      vals: { clusterIdx: [0] } as AnnotationVals,
      i: 0,
      expected: { left: 97.5, width: 2, minWidth: ANNOTATION_REGION_MIN_WIDTH },
    },
    {
      name: 'clustered region with width equal to threshold still expands',
      plotWidth: 600,
      left: 100,
      right: 105,
      vals: { clusterIdx: [0] } as AnnotationVals,
      i: 0,
      expected: { left: 97.5, width: 5, minWidth: ANNOTATION_REGION_MIN_WIDTH },
    },
    {
      name: 'clustered but wide enough has no min width',
      plotWidth: 600,
      left: 100,
      right: 120,
      vals: { clusterIdx: [0] } as AnnotationVals,
      i: 0,
      expected: { left: 100, width: 20, minWidth: undefined },
    },
    {
      name: 'narrow region without cluster index has no min width',
      plotWidth: 600,
      left: 100,
      right: 102,
      vals: { clusterIdx: [null] } as AnnotationVals,
      i: 0,
      expected: { left: 100, width: 2, minWidth: undefined },
    },
    {
      name: 'narrow region without clusterIdx field has no min width',
      plotWidth: 600,
      left: 100,
      right: 102,
      vals: {} as AnnotationVals,
      i: 0,
      expected: { left: 100, width: 2, minWidth: undefined },
    },
    {
      name: 'clamps left to 0 when shift would be negative',
      plotWidth: 600,
      left: 2,
      right: 3,
      vals: { clusterIdx: [0] } as AnnotationVals,
      i: 0,
      expected: { left: 0, width: 1, minWidth: ANNOTATION_REGION_MIN_WIDTH },
    },
    {
      name: 'clamps right edge to plot width before measuring width',
      plotWidth: 600,
      left: 598,
      right: 700,
      vals: { clusterIdx: [0] } as AnnotationVals,
      i: 0,
      expected: { left: 595.5, width: 2, minWidth: ANNOTATION_REGION_MIN_WIDTH },
    },
    {
      name: 'cluster index on another row does not apply to this row',
      plotWidth: 600,
      left: 100,
      right: 102,
      vals: { clusterIdx: [0, null] } as AnnotationVals,
      i: 1,
      expected: { left: 100, width: 2, minWidth: undefined },
    },
  ])('$name', ({ plotWidth, left, right, vals, i, expected }) => {
    const style = getAnnoRegionStyle(plotWidth, right, left, vals, i, '#F00', 4);
    expect(style.left).toBe(expected.left);
    expect(style.width).toBe(expected.width);
    expect(style.minWidth).toBe(expected.minWidth);
    expect(style.background).toBe('#F00');
    expect(style.top).toBe(4);
  });
});
