import {
  ArrayVector,
  DataTransformerConfig,
  DataTransformerID,
  FieldType,
  toDataFrame,
  transformDataFrame,
} from '@grafana/data';
import { orderFieldsTransformer, OrderFieldsTransformerOptions } from './order';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { observableTester } from '../../utils/tests/observableTester';

describe('Order Transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([orderFieldsTransformer]);
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

    it('should order according to config', done => {
      const cfg: DataTransformerConfig<OrderFieldsTransformerOptions> = {
        id: DataTransformerID.order,
        options: {
          indexByName: {
            time: 2,
            temperature: 0,
            humidity: 1,
          },
        },
      };

      observableTester().subscribeAndExpectOnNext({
        observable: transformDataFrame([cfg], [data]),
        expect: data => {
          const ordered = data[0];
          expect(ordered.fields).toEqual([
            {
              config: {},
              name: 'temperature',
              type: FieldType.number,
              values: new ArrayVector([10.3, 10.4, 10.5, 10.6]),
              labels: undefined,
              state: {
                displayName: 'temperature',
              },
            },
            {
              config: {},
              name: 'humidity',
              type: FieldType.number,
              values: new ArrayVector([10000.3, 10000.4, 10000.5, 10000.6]),
              labels: undefined,
              state: {
                displayName: 'humidity',
              },
            },
            {
              config: {},
              name: 'time',
              type: FieldType.time,
              values: new ArrayVector([3000, 4000, 5000, 6000]),
              labels: undefined,
              state: {
                displayName: 'time',
              },
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
      const cfg: DataTransformerConfig<OrderFieldsTransformerOptions> = {
        id: DataTransformerID.order,
        options: {
          indexByName: {
            time: 2,
            temperature: 0,
            humidity: 1,
          },
        },
      };

      observableTester().subscribeAndExpectOnNext({
        observable: transformDataFrame([cfg], [data]),
        expect: data => {
          const ordered = data[0];
          expect(ordered.fields).toEqual([
            {
              config: {},
              name: 'humidity',
              type: FieldType.number,
              values: new ArrayVector([10000.3, 10000.4, 10000.5, 10000.6]),
              labels: undefined,
              state: {
                displayName: 'humidity',
              },
            },
            {
              config: {},
              name: 'time',
              type: FieldType.time,
              values: new ArrayVector([3000, 4000, 5000, 6000]),
              labels: undefined,
              state: {
                displayName: 'time',
              },
            },
            {
              config: {},
              name: 'pressure',
              type: FieldType.number,
              values: new ArrayVector([10.3, 10.4, 10.5, 10.6]),
              labels: undefined,
              state: {
                displayName: 'pressure',
              },
            },
          ]);
        },
        done,
      });
    });
  });

  describe('when transforming with empty configuration', () => {
    const data = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
        { name: 'pressure', type: FieldType.number, values: [10.3, 10.4, 10.5, 10.6] },
        { name: 'humidity', type: FieldType.number, values: [10000.3, 10000.4, 10000.5, 10000.6] },
      ],
    });

    it('should keep the same order as in the incoming data', done => {
      const cfg: DataTransformerConfig<OrderFieldsTransformerOptions> = {
        id: DataTransformerID.order,
        options: {
          indexByName: {},
        },
      };

      observableTester().subscribeAndExpectOnNext({
        observable: transformDataFrame([cfg], [data]),
        expect: data => {
          const ordered = data[0];
          expect(ordered.fields).toEqual([
            {
              config: {},
              name: 'time',
              type: FieldType.time,
              values: new ArrayVector([3000, 4000, 5000, 6000]),
            },
            {
              config: {},
              name: 'pressure',
              type: FieldType.number,
              values: new ArrayVector([10.3, 10.4, 10.5, 10.6]),
            },
            {
              config: {},
              name: 'humidity',
              type: FieldType.number,
              values: new ArrayVector([10000.3, 10000.4, 10000.5, 10000.6]),
            },
          ]);
        },
        done,
      });
    });
  });
});
