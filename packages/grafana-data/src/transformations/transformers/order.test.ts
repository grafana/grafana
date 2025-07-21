import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { DataTransformerConfig } from '../../types/transformations';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';

import { DataTransformerID } from './ids';
import {
  OrderByMode,
  Order,
  orderFieldsTransformer,
  OrderFieldsTransformerOptions,
  OrderByType,
  OrderByItem,
} from './order';

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
          orderByMode: OrderByMode.Manual,
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
          orderByMode: OrderByMode.Manual,
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
          orderByMode: OrderByMode.Manual,
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
          orderByMode: OrderByMode.Manual,
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
            state: {
              displayName: 'pressure',
              multipleFrames: false,
            },
          },
          {
            config: {},
            name: 'humidity',
            type: FieldType.number,
            values: [10000.3, 10000.4, 10000.5, 10000.6],
            state: {
              displayName: 'humidity',
              multipleFrames: false,
            },
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
      'When the order is (with index order as given) label pod: $labelPodOrder / label user: $labelUserOrder / field name: $fieldNameOrder , then the field order is $expectedFieldNameOrder',
      async ({ labelPodOrder, labelUserOrder, fieldNameOrder, expectedFieldNameOrder }) => {
        let items: OrderByItem[] = [];

        if (labelPodOrder !== Order.Off) {
          items.push({ type: OrderByType.Label, name: 'pod', desc: labelPodOrder === Order.Desc });
        }

        if (labelUserOrder !== Order.Off) {
          items.push({ type: OrderByType.Label, name: 'user', desc: labelUserOrder === Order.Desc });
        }

        if (fieldNameOrder !== Order.Off) {
          items.push({ type: OrderByType.Name, desc: fieldNameOrder === Order.Desc });
        }

        const cfg: DataTransformerConfig<OrderFieldsTransformerOptions> = {
          id: DataTransformerID.order,
          options: {
            orderByMode: OrderByMode.Auto,
            orderBy: items,
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

    it.each`
      labelPodIndex | labelUserIndex | fieldNameIndex | expectedFieldNameOrder
      ${0}          | ${1}           | ${2}           | ${['Series-3', 'Series-1', 'Series-2']}
      ${0}          | ${2}           | ${1}           | ${['Series-3', 'Series-2', 'Series-1']}
      ${1}          | ${0}           | ${2}           | ${['Series-3', 'Series-1', 'Series-2']}
      ${2}          | ${0}           | ${1}           | ${['Series-3', 'Series-1', 'Series-2']}
      ${1}          | ${2}           | ${0}           | ${['Series-3', 'Series-2', 'Series-1']}
      ${2}          | ${1}           | ${0}           | ${['Series-3', 'Series-2', 'Series-1']}
    `(
      'When the indexes are label pod: $labelPodIndex / label user: $labelUserIndex / field name: $fieldNameIndex when all of them are sort DESC, then the field order is $expectedFieldNameOrder',
      async ({ labelPodIndex, labelUserIndex, fieldNameIndex, expectedFieldNameOrder }) => {
        let items: OrderByItem[] = Array(3);

        items[labelPodIndex] = { type: OrderByType.Label, name: 'pod', desc: true };
        items[labelUserIndex] = { type: OrderByType.Label, name: 'user', desc: true };
        items[fieldNameIndex] = { type: OrderByType.Name, desc: true };

        const cfg: DataTransformerConfig<OrderFieldsTransformerOptions> = {
          id: DataTransformerID.order,
          options: {
            orderByMode: OrderByMode.Auto,
            orderBy: items,
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

    it('should always keep the first time field first', async () => {
      const data = toDataFrame({
        name: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [3000] },
          { name: 'pressure', type: FieldType.number, values: [10.3] },
          { name: 'humidity', type: FieldType.number, values: [10000.3] },
        ],
      });

      // ascending sort on name means time would be last
      const cfg: DataTransformerConfig<OrderFieldsTransformerOptions> = {
        id: DataTransformerID.order,
        options: {
          orderByMode: OrderByMode.Auto,
          orderBy: [{ type: OrderByType.Name, desc: false }],
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
            values: [3000],
            state: {
              displayName: 'time',
              multipleFrames: false,
            },
          },
          {
            config: {},
            name: 'humidity',
            type: FieldType.number,
            values: [10000.3],
            state: {
              displayName: 'humidity',
              multipleFrames: false,
            },
          },
          {
            config: {},
            name: 'pressure',
            type: FieldType.number,
            values: [10.3],
            state: {
              displayName: 'pressure',
              multipleFrames: false,
            },
          },
        ]);
      });
    });
  });
});
