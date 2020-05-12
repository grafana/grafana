import {
  ArrayVector,
  DataTransformerConfig,
  DataTransformerID,
  FieldType,
  toDataFrame,
  transformDataFrame,
} from '@grafana/data';
import { RenameFieldsTransformerOptions, renameFieldsTransformer } from './rename';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';

describe('Rename Transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([renameFieldsTransformer]);
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

    it('should rename according to config', () => {
      const cfg: DataTransformerConfig<RenameFieldsTransformerOptions> = {
        id: DataTransformerID.rename,
        options: {
          renameByName: {
            time: 'Total time',
            humidity: 'Moistiness',
            temperature: 'how cold is it?',
          },
        },
      };

      const renamed = transformDataFrame([cfg], [data])[0];

      expect(renamed.fields).toEqual([
        {
          config: {
            displayName: 'Total time',
          },
          labels: undefined,
          name: 'time',
          state: {
            displayName: 'Total time',
          },
          type: FieldType.time,
          values: new ArrayVector([3000, 4000, 5000, 6000]),
        },
        {
          config: {
            displayName: 'how cold is it?',
          },
          labels: undefined,
          name: 'temperature',
          state: {
            displayName: 'how cold is it?',
          },
          type: FieldType.number,
          values: new ArrayVector([10.3, 10.4, 10.5, 10.6]),
        },
        {
          config: {
            displayName: 'Moistiness',
          },
          name: 'humidity',
          labels: undefined,
          state: {
            displayName: 'Moistiness',
          },
          type: FieldType.number,
          values: new ArrayVector([10000.3, 10000.4, 10000.5, 10000.6]),
        },
      ]);
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

    it('should not rename fields missing in config', () => {
      const cfg: DataTransformerConfig<RenameFieldsTransformerOptions> = {
        id: DataTransformerID.rename,
        options: {
          renameByName: {
            time: 'ttl',
            temperature: 'temp',
            humidity: 'hum',
          },
        },
      };

      const renamed = transformDataFrame([cfg], [data])[0];

      expect(renamed.fields).toEqual([
        {
          config: {
            displayName: 'ttl',
          },
          name: 'time',
          labels: undefined,
          state: {
            displayName: 'ttl',
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
        {
          config: {
            displayName: 'hum',
          },
          labels: undefined,
          name: 'humidity',
          state: {
            displayName: 'hum',
          },
          type: FieldType.number,
          values: new ArrayVector([10000.3, 10000.4, 10000.5, 10000.6]),
        },
      ]);
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

    it('should keep the same names as in the incoming data', () => {
      const cfg: DataTransformerConfig<RenameFieldsTransformerOptions> = {
        id: DataTransformerID.rename,
        options: {
          renameByName: {},
        },
      };

      const renamed = transformDataFrame([cfg], [data])[0];

      expect(renamed.fields).toEqual([
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
