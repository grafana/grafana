import { createTheme, FieldType, Field, ThresholdsMode, MappingType } from '@grafana/data';
import { FieldColorModeId } from '@grafana/schema/dist/esm/index.gen';

import { getEnumConfig } from './scatter';

describe('value mapping function', () => {
  it('thresholds', () => {
    const field: Field<number | null> = {
      name: 'A',
      type: FieldType.number,
      values: [0, 10, 20, 30, 40, 50],
      config: {
        mappings: undefined,
        thresholds: {
          mode: ThresholdsMode.Absolute,
          steps: [
            {
              value: -Infinity,
              color: 'green',
            },
            {
              value: 30,
              color: 'red',
            },
          ],
        },
        color: {
          mode: FieldColorModeId.Thresholds,
        },
      },
    };

    const { index, getAll } = getEnumConfig(field, createTheme());
    expect(index).toEqual({ color: ['#73bf69ff', '#f2495cff'], icon: ['', ''], text: ['< 30', '≥ 30'] });
    expect(getAll(field.values)).toEqual([0, 0, 0, 1, 1, 1]);
  });

  it('mappings (with dedupe)', () => {
    const field: Field<number | null> = {
      name: 'A',
      type: FieldType.number,
      values: [5, 6, 7, 8, 9, 10, 11, 32, 40, null],
      config: {
        mappings: [
          {
            options: {
              '21': {
                color: '#fade2a',
                index: 10,
                text: 'Manual Stop',
              },
              '22': {
                color: '#f2495c',
                index: 9,
                text: 'Instant Shutdown',
              },
              '23': {
                color: '#ff9830',
                index: 8,
                text: 'Delayed Shutdown',
              },
              '30': {
                color: '#5794f2',
                index: 7,
                text: 'Propel',
              },
              '31': {
                color: '#ffa6b0',
                index: 6,
                text: 'Limits Mode',
              },
              '32': {
                color: '#73bf69',
                index: 5,
                text: 'Production',
              },
              '33': {
                color: '#ffcb7d',
                index: 4,
                text: 'Motivator Mode',
              },
              '40': {
                color: '#73bf69',
                index: 3,
                text: 'Production',
              },
              null: {
                color: '#808080',
                index: 2,
                text: 'N/A',
              },
            },
            type: MappingType.ValueToText,
          },
          {
            options: {
              from: 41,
              result: {
                color: '#a352cc',
                index: 0,
                text: 'Maintenance Mode',
              },
              to: 45,
            },
            type: MappingType.RangeToText,
          },
          {
            options: {
              from: 5,
              result: {
                color: '#73bf69',
                index: 1,
                text: 'Production',
              },
              to: 11,
            },
            type: MappingType.RangeToText,
          },
        ],
        color: {
          mode: FieldColorModeId.Fixed,
        },
      },
    };

    // this should merge states with equal text+color+icon
    const { index, getAll } = getEnumConfig(field, createTheme());
    expect(index).toEqual({
      color: [
        '#fade2aff',
        '#f2495cff',
        '#ff9830ff',
        '#5794f2ff',
        '#ffa6b0ff',
        '#73bf69ff',
        '#ffcb7dff',
        '#808080ff',
        '#a352ccff',
      ],
      icon: ['', '', '', '', '', '', '', '', ''],
      text: [
        'Manual Stop',
        'Instant Shutdown',
        'Delayed Shutdown',
        'Propel',
        'Limits Mode',
        'Production',
        'Motivator Mode',
        'N/A',
        'Maintenance Mode',
      ],
    });
    expect(getAll(field.values)).toEqual([5, 5, 5, 5, 5, 5, 5, 5, 5, 7]);
  });
});
