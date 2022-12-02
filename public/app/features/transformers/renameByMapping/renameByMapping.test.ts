import { toDataFrame, FieldType } from '@grafana/data';

import { renameFrameByMapping, RenameByMappingTransformOptions } from './renameByMapping';

describe('Rename By Mapping Transformer', () => {
  describe('replace a name with a name from mapping', () => {
    const frame = toDataFrame({
      name: 'aaa',
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
          config: { displayName: 'aaa' },
          values: [10000.3, 10000.4, 10000.5, 10000.6],
        },
      ],
    });

    it('should rename from the mapping', () => {
      const options: RenameByMappingTransformOptions = {
        varName: 'thing',
      };

      const mapping = {
        aaa: 'bbb',
      };

      const result = renameFrameByMapping(options, mapping)(frame);
      expect(result.fields).toMatchInlineSnapshot(`
        [
          {
            "config": {
              "displayName": "Time",
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
              "displayName": "bbb",
            },
            "name": "Value",
            "state": {
              "displayName": "bbb",
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

  describe('rename individual tokens from mapping', () => {
    const frame = toDataFrame({
      name: 'aaa',
      fields: [
        {
          name: 'Time',
          type: FieldType.time,
          config: {
            name: 'Time',
            displayName: '999',
          },
          values: [3000, 4000, 5000, 6000],
        },
        {
          name: 'Value',
          type: FieldType.number,
          config: { displayName: '   11-1  222    333' },
          values: [10000.3, 10000.4, 10000.5, 10000.6],
        },
      ],
    });

    it('rename 2 out of 3 tokens and preserve space', () => {
      const options: RenameByMappingTransformOptions = {
        varName: 'thing',
      };

      const mapping = {
        '11-1': 'aaa',
        '333': 'ccc',
        '999': 'iii',
      };

      const result = renameFrameByMapping(options, mapping)(frame);
      expect(result.fields).toMatchInlineSnapshot(`
        [
          {
            "config": {
              "displayName": "iii",
              "name": "Time",
            },
            "name": "Time",
            "state": {
              "displayName": "iii",
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
              "displayName": "   aaa  222    ccc",
            },
            "name": "Value",
            "state": {
              "displayName": "   aaa  222    ccc",
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
