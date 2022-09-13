import { toDataFrame } from '../../dataframe';
import { FieldType, DataTransformerConfig } from '../../types';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { ArrayVector } from '../../vector';
import { transformDataFrame } from '../transformDataFrame';

import { DataTransformerID } from './ids';
import { orderFieldsTransformer, OrderFieldsTransformerOptions } from './order';

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

    it('should order according to config', async () => {
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

      await expect(transformDataFrame([cfg], [data])).toEmitValuesWith((received) => {
        const data = received[0];
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
              multipleFrames: false,
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
              multipleFrames: false,
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
              multipleFrames: false,
            },
          },
        ]);
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

    it('should append fields missing in config at the end', async () => {
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

      await expect(transformDataFrame([cfg], [data])).toEmitValuesWith((received) => {
        const data = received[0];
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
              multipleFrames: false,
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
              multipleFrames: false,
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
              multipleFrames: false,
            },
          },
        ]);
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

    it('should keep the same order as in the incoming data', async () => {
      const cfg: DataTransformerConfig<OrderFieldsTransformerOptions> = {
        id: DataTransformerID.order,
        options: {
          indexByName: {},
        },
      };

      await expect(transformDataFrame([cfg], [data])).toEmitValuesWith((received) => {
        const data = received[0];
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
      });
    });
  });
});
