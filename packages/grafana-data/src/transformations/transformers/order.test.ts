import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { DataTransformerConfig } from '../../types/transformations';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';

import { DataTransformerID } from './ids';
import { FieldOrdering, Order, orderFieldsTransformer, OrderFieldsTransformerOptions } from './order';

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
          fieldOrder: FieldOrdering.Manual,
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
            values: [10.3, 10.4, 10.5, 10.6],
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
            values: [10000.3, 10000.4, 10000.5, 10000.6],
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
            values: [3000, 4000, 5000, 6000],
            labels: undefined,
            state: {
              displayName: 'time',
              multipleFrames: false,
            },
          },
        ]);
      });
    });

    it('should disable order according to config', async () => {
      const cfg: DataTransformerConfig<OrderFieldsTransformerOptions> = {
        id: DataTransformerID.order,
        disabled: true,
        options: {
          fieldOrder: FieldOrdering.Manual,
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
            name: 'time',
            type: FieldType.time,
            values: [3000, 4000, 5000, 6000],
            labels: undefined,
            state: {
              displayName: 'time',
              multipleFrames: false,
            },
          },
          {
            config: {},
            name: 'temperature',
            type: FieldType.number,
            values: [10.3, 10.4, 10.5, 10.6],
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
            values: [10000.3, 10000.4, 10000.5, 10000.6],
            labels: undefined,
            state: {
              displayName: 'humidity',
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
          fieldOrder: FieldOrdering.Manual,
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
            values: [10000.3, 10000.4, 10000.5, 10000.6],
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
            values: [3000, 4000, 5000, 6000],
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
            values: [10.3, 10.4, 10.5, 10.6],
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
          fieldOrder: FieldOrdering.Manual,
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
            values: [3000, 4000, 5000, 6000],
          },
          {
            config: {},
            name: 'pressure',
            type: FieldType.number,
            values: [10.3, 10.4, 10.5, 10.6],
          },
          {
            config: {},
            name: 'humidity',
            type: FieldType.number,
            values: [10000.3, 10000.4, 10000.5, 10000.6],
          },
        ]);
      });
    });
  });

  describe('auto order', () => {
    it.each`
      labelPodOrder | labelUserOrder | fieldNameOrder | expectedFieldNameOrder
      ${Order.Off}  | ${Order.Off}   | ${Order.Off}   | ${['Series-1', 'Series-2', 'Series-3']}
      ${Order.Off}  | ${Order.Asc}   | ${Order.Off}   | ${['Series-2', 'Series-1', 'Series-3']}
      ${Order.Off}  | ${Order.Off}   | ${Order.Asc}   | ${['Series-1', 'Series-2', 'Series-3']}
      ${Order.Off}  | ${Order.Desc}  | ${Order.Off}   | ${['Series-1', 'Series-3', 'Series-2']}
      ${Order.Off}  | ${Order.Off}   | ${Order.Desc}  | ${['Series-3', 'Series-2', 'Series-1']}
      ${Order.Off}  | ${Order.Desc}  | ${Order.Desc}  | ${['Series-3', 'Series-1', 'Series-2']}
      ${Order.Off}  | ${Order.Asc}   | ${Order.Asc}   | ${['Series-2', 'Series-1', 'Series-3']}
      ${Order.Off}  | ${Order.Asc}   | ${Order.Desc}  | ${['Series-2', 'Series-3', 'Series-1']}
      ${Order.Off}  | ${Order.Desc}  | ${Order.Asc}   | ${['Series-1', 'Series-3', 'Series-2']}
      ${Order.Asc}  | ${Order.Off}   | ${Order.Off}   | ${['Series-1', 'Series-2', 'Series-3']}
      ${Order.Asc}  | ${Order.Off}   | ${Order.Asc}   | ${['Series-1', 'Series-2', 'Series-3']}
      ${Order.Asc}  | ${Order.Off}   | ${Order.Desc}  | ${['Series-2', 'Series-1', 'Series-3']}
      ${Order.Asc}  | ${Order.Asc}   | ${Order.Off}   | ${['Series-2', 'Series-1', 'Series-3']}
      ${Order.Asc}  | ${Order.Desc}  | ${Order.Off}   | ${['Series-1', 'Series-2', 'Series-3']}
      ${Order.Asc}  | ${Order.Desc}  | ${Order.Desc}  | ${['Series-1', 'Series-2', 'Series-3']}
      ${Order.Asc}  | ${Order.Asc}   | ${Order.Asc}   | ${['Series-2', 'Series-1', 'Series-3']}
      ${Order.Asc}  | ${Order.Asc}   | ${Order.Desc}  | ${['Series-2', 'Series-1', 'Series-3']}
      ${Order.Asc}  | ${Order.Desc}  | ${Order.Asc}   | ${['Series-1', 'Series-2', 'Series-3']}
      ${Order.Desc} | ${Order.Asc}   | ${Order.Off}   | ${['Series-3', 'Series-2', 'Series-1']}
      ${Order.Desc} | ${Order.Off}   | ${Order.Asc}   | ${['Series-3', 'Series-1', 'Series-2']}
      ${Order.Desc} | ${Order.Off}   | ${Order.Desc}  | ${['Series-3', 'Series-2', 'Series-1']}
      ${Order.Desc} | ${Order.Asc}   | ${Order.Asc}   | ${['Series-3', 'Series-2', 'Series-1']}
      ${Order.Desc} | ${Order.Asc}   | ${Order.Desc}  | ${['Series-3', 'Series-2', 'Series-1']}
      ${Order.Desc} | ${Order.Desc}  | ${Order.Asc}   | ${['Series-3', 'Series-1', 'Series-2']}
      ${Order.Desc} | ${Order.Desc}  | ${Order.Off}   | ${['Series-3', 'Series-1', 'Series-2']}
      ${Order.Desc} | ${Order.Desc}  | ${Order.Desc}  | ${['Series-3', 'Series-1', 'Series-2']}
      ${Order.Desc} | ${Order.Off}   | ${Order.Off}   | ${['Series-3', 'Series-1', 'Series-2']}
    `(
      'When the order is label pod (with index order as given): $labelPodOrder / label user: $labelUserOrder / field name: $fieldNameOrder , then the field order is $expectedFieldNameOrder',
      async ({ labelPodOrder, labelUserOrder, fieldNameOrder, expectedFieldNameOrder }) => {
        const cfg: DataTransformerConfig<OrderFieldsTransformerOptions> = {
          id: DataTransformerID.order,
          options: {
            fieldOrder: FieldOrdering.Auto,
            fieldNameSort: { index: 3, order: fieldNameOrder },
            labelSort: [
              { index: 0, labelName: 'pod', order: labelPodOrder },
              { index: 1, labelName: 'user', order: labelUserOrder },
            ],
          },
        };

        const data = toDataFrame({
          name: 'A',
          fields: [
            {
              name: 'Series-1',
              type: FieldType.number,
              labels: { pod: 123, user: 555 },
              values: [10.3],
            },
            {
              name: 'Series-2',
              type: FieldType.number,
              labels: { pod: 123, user: 312 },
              values: [100.3],
            },
            {
              name: 'Series-3',
              labels: { pod: 456, user: 555 },
              type: FieldType.number,
              values: [10000.3],
            },
          ],
        });

        await expect(transformDataFrame([cfg], [data])).toEmitValuesWith((received) => {
          const data = received[0];
          const ordered = data[0];
          expect(ordered.fields.map((f) => f.name)).toEqual(expectedFieldNameOrder);
        });
      }
    );
  });
});
