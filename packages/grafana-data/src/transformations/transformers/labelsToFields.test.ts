import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { LabelsToFieldsOptions, labelsToFieldsTransformer } from './labelsToFields';
import { DataTransformerConfig, FieldDTO, FieldType } from '../../types';
import { DataTransformerID } from './ids';
import { toDataFrame, toDataFrameDTO } from '../../dataframe';
import { transformDataFrame } from '../transformDataFrame';
import { observableTester } from '../../utils/tests/observableTester';

describe('Labels as Columns', () => {
  beforeAll(() => {
    mockTransformationsRegistry([labelsToFieldsTransformer]);
  });

  it('data frame with two labels', done => {
    const cfg: DataTransformerConfig<LabelsToFieldsOptions> = {
      id: DataTransformerID.labelsToFields,
      options: {},
    };

    const source = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000] },
        { name: 'Value', type: FieldType.number, values: [1, 2], labels: { location: 'inside', feelsLike: 'ok' } },
      ],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [source]),
      expect: data => {
        const result = toDataFrameDTO(data[0]);

        const expected: FieldDTO[] = [
          { name: 'time', type: FieldType.time, values: [1000, 2000], config: {} },
          {
            name: 'location',
            type: FieldType.string,
            values: ['inside', 'inside'],
            config: {},
          },
          { name: 'feelsLike', type: FieldType.string, values: ['ok', 'ok'], config: {} },
          { name: 'Value', type: FieldType.number, values: [1, 2], config: {} },
        ];

        expect(result.fields).toEqual(expected);
      },
      done,
    });
  });

  it('data frame with two labels and valueLabel option', done => {
    const cfg: DataTransformerConfig<LabelsToFieldsOptions> = {
      id: DataTransformerID.labelsToFields,
      options: { valueLabel: 'name' },
    };

    const source = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000] },
        {
          name: 'Value',
          type: FieldType.number,
          values: [1, 2],
          labels: { location: 'inside', name: 'Request' },
          config: {
            displayName: 'Custom1',
            displayNameFromDS: 'Custom2',
          },
        },
      ],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [source]),
      expect: data => {
        const result = toDataFrameDTO(data[0]);

        const expected: FieldDTO[] = [
          { name: 'time', type: FieldType.time, values: [1000, 2000], config: {} },
          {
            name: 'location',
            type: FieldType.string,
            values: ['inside', 'inside'],
            config: {},
          },
          { name: 'Request', type: FieldType.number, values: [1, 2], config: {} },
        ];

        expect(result.fields).toEqual(expected);
      },
      done,
    });
  });

  it('two data frames with 1 value and 1 label', done => {
    const cfg: DataTransformerConfig<LabelsToFieldsOptions> = {
      id: DataTransformerID.labelsToFields,
      options: {},
    };

    const oneValueOneLabelA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000] },
        { name: 'temp', type: FieldType.number, values: [1], labels: { location: 'inside' } },
      ],
    });

    const oneValueOneLabelB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'time', type: FieldType.time, values: [2000] },
        { name: 'temp', type: FieldType.number, values: [-1], labels: { location: 'outside' } },
      ],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [oneValueOneLabelA, oneValueOneLabelB]),
      expect: data => {
        const result = toDataFrameDTO(data[0]);

        const expected: FieldDTO[] = [
          { name: 'time', type: FieldType.time, values: [1000, 2000], config: {} },
          { name: 'location', type: FieldType.string, values: ['inside', 'outside'], config: {} },
          { name: 'temp', type: FieldType.number, values: [1, -1], config: {} },
        ];

        expect(result.fields).toEqual(expected);
      },
      done,
    });
  });
});
