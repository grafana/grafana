import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { DataTransformerConfig } from '../../types/transformations';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';

import { DataTransformerID } from './ids';
import { renameByRegexTransformer, RenameByRegexTransformerOptions } from './renameByRegex';

describe('Rename By Regex Transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([renameByRegexTransformer]);
  });

  describe('when regex and replacement pattern', () => {
    const data = toDataFrame({
      name: 'web-01.example.com',
      fields: [
        {
          name: 'Time',
          type: FieldType.time,
          config: { name: 'Time' },
          values: [3000, 4000, 5000, 6000],
        },
        {
          name: 'Value',
          type: FieldType.number,
          config: { displayName: 'web-01.example.com' },
          values: [10000.3, 10000.4, 10000.5, 10000.6],
        },
      ],
    });

    it('should rename matches using references', async () => {
      const cfg: DataTransformerConfig<RenameByRegexTransformerOptions> = {
        id: DataTransformerID.renameByRegex,
        options: {
          regex: '([^.]+).example.com',
          renamePattern: '$1',
        },
      };
      await expect(transformDataFrame([cfg], [data])).toEmitValuesWith((received) => {
        const data = received[0];
        const frame = data[0];
        expect(frame.fields).toMatchInlineSnapshot(`
          [
            {
              "config": {
                "name": "Time",
              },
              "name": "Time",
              "state": {
                "displayName": "Time",
                "multipleFrames": false,
              },
              "type": "time",
              "values": [
                3000,
                4000,
                5000,
                6000,
              ],
            },
            {
              "config": {
                "displayName": "web-01",
              },
              "name": "Value",
              "state": {
                "displayName": "web-01",
                "multipleFrames": false,
              },
              "type": "number",
              "values": [
                10000.3,
                10000.4,
                10000.5,
                10000.6,
              ],
            },
          ]
        `);
      });
    });

    it('should be able to replace globally', async () => {
      const cfg: DataTransformerConfig<RenameByRegexTransformerOptions> = {
        id: DataTransformerID.renameByRegex,
        options: {
          regex: '/e/g',
          renamePattern: 'E',
        },
      };
      await expect(transformDataFrame([cfg], [data])).toEmitValuesWith((received) => {
        const data = received[0];
        const frame = data[0];
        expect(frame.fields).toMatchInlineSnapshot(`
          [
            {
              "config": {
                "displayName": "TimE",
                "name": "Time",
              },
              "name": "Time",
              "state": {
                "displayName": "TimE",
                "multipleFrames": false,
              },
              "type": "time",
              "values": [
                3000,
                4000,
                5000,
                6000,
              ],
            },
            {
              "config": {
                "displayName": "wEb-01.ExamplE.com",
              },
              "name": "Value",
              "state": {
                "displayName": "wEb-01.ExamplE.com",
                "multipleFrames": false,
              },
              "type": "number",
              "values": [
                10000.3,
                10000.4,
                10000.5,
                10000.6,
              ],
            },
          ]
        `);
      });
    });

    it('should not rename misses', async () => {
      const cfg: DataTransformerConfig<RenameByRegexTransformerOptions> = {
        id: DataTransformerID.renameByRegex,
        options: {
          regex: '([^.]+).bad-domain.com',
          renamePattern: '$1',
        },
      };
      await expect(transformDataFrame([cfg], [data])).toEmitValuesWith((received) => {
        const data = received[0];
        const frame = data[0];
        expect(frame.fields).toMatchInlineSnapshot(`
          [
            {
              "config": {
                "name": "Time",
              },
              "name": "Time",
              "state": {
                "displayName": "Time",
                "multipleFrames": false,
              },
              "type": "time",
              "values": [
                3000,
                4000,
                5000,
                6000,
              ],
            },
            {
              "config": {
                "displayName": "web-01.example.com",
              },
              "name": "Value",
              "state": {
                "displayName": "web-01.example.com",
                "multipleFrames": false,
              },
              "type": "number",
              "values": [
                10000.3,
                10000.4,
                10000.5,
                10000.6,
              ],
            },
          ]
        `);
      });
    });

    it('should not rename with empty regex and repacement pattern', async () => {
      const cfg: DataTransformerConfig<RenameByRegexTransformerOptions> = {
        id: DataTransformerID.renameByRegex,
        options: {
          regex: '',
          renamePattern: '',
        },
      };
      await expect(transformDataFrame([cfg], [data])).toEmitValuesWith((received) => {
        const data = received[0];
        const frame = data[0];
        expect(frame.fields).toMatchInlineSnapshot(`
          [
            {
              "config": {
                "name": "Time",
              },
              "name": "Time",
              "state": {
                "displayName": "Time",
                "multipleFrames": false,
              },
              "type": "time",
              "values": [
                3000,
                4000,
                5000,
                6000,
              ],
            },
            {
              "config": {
                "displayName": "web-01.example.com",
              },
              "name": "Value",
              "state": {
                "displayName": "web-01.example.com",
                "multipleFrames": false,
              },
              "type": "number",
              "values": [
                10000.3,
                10000.4,
                10000.5,
                10000.6,
              ],
            },
          ]
        `);
      });
    });
  });
});
