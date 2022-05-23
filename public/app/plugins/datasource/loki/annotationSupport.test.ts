import { take } from 'rxjs';

import { AnnotationEventFieldSource, AnnotationQuery, DataFrame, FieldType, MutableDataFrame } from '@grafana/data';

import { LokiAnnotationSupport } from './annotationSupport';

const annotationQuery: AnnotationQuery = {
  enable: true,
  iconColor: 'purple',
  mappings: {
    time: {
      source: AnnotationEventFieldSource.Field,
      value: 'Time',
    },
    text: {
      source: AnnotationEventFieldSource.Field,
      value: 'Status',
    },
    title: {
      source: AnnotationEventFieldSource.Field,
      value: 'Line',
    },
    tags: {
      source: AnnotationEventFieldSource.Field,
      value: 'labels',
    },
  },
  name: 'New annotation',
};

const frame: DataFrame[] = [
  new MutableDataFrame({
    refId: 'Anno',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: ['2022-05-23T15:06:51.303Z', '2022-05-23T15:06:51.303Z'],
      },
      {
        name: 'Status',
        type: FieldType.string,
        config: {},
        values: ['Status1', 'Status2'],
      },
      {
        name: 'Line',
        type: FieldType.string,
        config: {},
        values: ['Line1', 'Line2'],
      },
      {
        name: 'labels',
        type: FieldType.other,
        config: {},
        values: [
          {
            filename: '/var/log/system.log',
            job: 'varlogs',
          },
          {
            filename: '/var/log/solution.log',
            job: 'grafana',
          },
        ],
      },
    ],
  }),
];

describe('annotationSupport', () => {
  describe('when processEvents', () => {
    it('should return the same query without changing it', async () => {
      // const processEvent = await LokiAnnotationSupport.processEvents(annotationQuery, frame);
      await expect(LokiAnnotationSupport.processEvents(annotationQuery, frame).pipe(take(1))).toEmitValuesWith(
        (res) => {
          expect(res[0].length).toBe(2);
          expect(res[0][0]['time']).toBe(1653318411303);
          expect(res[0][0]['title']).toBe('Line1');
          expect(res[0][0]['text']).toBe('Status1');
          expect(res[0][0]['tags']?.length).toBe(2);
          let tags = res[0][0]['tags'] ?? [];
          expect(tags[0]).toBe('/var/log/system.log');
          expect(tags[1]).toBe('varlogs');

          expect(res[0][1]['time']).toBe(1653318411303);
          expect(res[0][1]['title']).toBe('Line2');
          expect(res[0][1]['text']).toBe('Status2');
          expect(res[0][1]['tags']?.length).toBe(2);
          tags = res[0][1]['tags'] ?? [];
          expect(tags[0]).toBe('/var/log/solution.log');
          expect(tags[1]).toBe('grafana');
        }
      );
    });
  });
});
