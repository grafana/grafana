import {
  ArrayVector,
  DataTransformerConfig,
  DataTransformerID,
  FieldType,
  toDataFrame,
  transformDataFrame,
} from '@grafana/data';
import { organizeFieldsTransformer, OrganizeFieldsTransformerOptions } from './organize';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { observableTester } from '../../utils/tests/observableTester';

describe('OrganizeFields Transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([organizeFieldsTransformer]);
  });

  describe('when consistent data is received', () => {
    const data = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
        { name: 'temperature', type: FieldType.number, values: [10.3, 10.4, 10.5, 10.6] },
        { name: 'humidity', type: FieldType.number, values: [10000.3, 10000.4, 10000.5, 10000.6] },
      ],
    });

    it('should order and filter according to config', done => {
      const cfg: DataTransformerConfig<OrganizeFieldsTransformerOptions> = {
        id: DataTransformerID.organize,
        options: {
          indexByName: {
            time: 2,
            temperature: 0,
            humidity: 1,
          },
          excludeByName: {
            time: true,
          },
          renameByName: {
            humidity: 'renamed_humidity',
          },
        },
      };

      observableTester().subscribeAndExpectOnNext({
        observable: transformDataFrame([cfg], [data]),
        expect: data => {
          const organized = data[0];
          expect(organized.fields).toEqual([
            {
              config: {},
              labels: undefined,
              name: 'temperature',
              state: {
                displayName: 'temperature',
              },
              type: FieldType.number,
              values: new ArrayVector([10.3, 10.4, 10.5, 10.6]),
            },
            {
              config: {
                displayName: 'renamed_humidity',
              },
              labels: undefined,
              name: 'humidity',
              state: {
                displayName: 'renamed_humidity',
              },
              type: FieldType.number,
              values: new ArrayVector([10000.3, 10000.4, 10000.5, 10000.6]),
            },
          ]);
        },
        done,
      });
    });
  });

  describe('when inconsistent data is received', () => {
    const data = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
        { name: 'pressure', type: FieldType.number, values: [10.3, 10.4, 10.5, 10.6] },
        { name: 'humidity', type: FieldType.number, values: [10000.3, 10000.4, 10000.5, 10000.6] },
      ],
    });

    it('should append fields missing in config at the end', done => {
      const cfg: DataTransformerConfig<OrganizeFieldsTransformerOptions> = {
        id: DataTransformerID.organize,
        options: {
          indexByName: {
            time: 2,
            temperature: 0,
            humidity: 1,
          },
          excludeByName: {
            humidity: true,
          },
          renameByName: {
            time: 'renamed_time',
          },
        },
      };

      observableTester().subscribeAndExpectOnNext({
        observable: transformDataFrame([cfg], [data]),
        expect: data => {
          const organized = data[0];
          expect(organized.fields).toEqual([
            {
              labels: undefined,
              config: {
                displayName: 'renamed_time',
              },
              name: 'time',
              state: {
                displayName: 'renamed_time',
              },
              type: FieldType.time,
              values: new ArrayVector([3000, 4000, 5000, 6000]),
            },
            {
              config: {},
              labels: undefined,
              name: 'pressure',
              state: {
                displayName: 'pressure',
              },
              type: FieldType.number,
              values: new ArrayVector([10.3, 10.4, 10.5, 10.6]),
            },
          ]);
        },
        done,
      });
    });
  });
});
