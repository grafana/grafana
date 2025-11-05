import { arrayToDataFrame, createDataFrame, DataFrame, DataTopic, FieldType } from '@grafana/data';

import { getXAnnotationFrames, getXYAnnotationFrames } from './utils';

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
