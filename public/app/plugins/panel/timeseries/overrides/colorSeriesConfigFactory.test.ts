import { FieldMatcherID } from '@grafana/data/transformations';
import { FieldColorModeId, type FieldConfigSource } from '@grafana/data/types';

import { changeSeriesColorConfigFactory } from './colorSeriesConfigFactory';

describe('changeSeriesColorConfigFactory', () => {
  it('should create config override to change color for serie', () => {
    const label = 'temperature';
    const color = 'green';

    const existingConfig: FieldConfigSource = {
      defaults: {},
      overrides: [],
    };

    const config = changeSeriesColorConfigFactory(label, color, existingConfig);

    expect(config).toEqual({
      defaults: {},
      overrides: [
        {
          matcher: {
            id: FieldMatcherID.byName,
            options: label,
          },
          properties: [
            {
              id: 'color',
              value: {
                mode: FieldColorModeId.Fixed,
                fixedColor: color,
              },
            },
          ],
        },
      ],
    });
  });

  it('should create config override to change color for serie when override already exists for series', () => {
    const label = 'temperature';
    const color = 'green';

    const existingConfig: FieldConfigSource = {
      defaults: {},
      overrides: [
        {
          matcher: {
            id: FieldMatcherID.byName,
            options: label,
          },
          properties: [
            {
              id: 'other',
              value: 'other',
            },
          ],
        },
      ],
    };

    const config = changeSeriesColorConfigFactory(label, color, existingConfig);

    expect(config).toEqual({
      defaults: {},
      overrides: [
        {
          matcher: {
            id: FieldMatcherID.byName,
            options: label,
          },
          properties: [
            {
              id: 'other',
              value: 'other',
            },
            {
              id: 'color',
              value: {
                mode: FieldColorModeId.Fixed,
                fixedColor: color,
              },
            },
          ],
        },
      ],
    });
  });

  it('should update existing color property without mutating the original', () => {
    const label = 'temperature';

    const existingConfig: FieldConfigSource = {
      defaults: {},
      overrides: [
        {
          matcher: {
            id: FieldMatcherID.byName,
            options: label,
          },
          properties: [
            {
              id: 'color',
              value: {
                mode: FieldColorModeId.Fixed,
                fixedColor: 'green',
              },
            },
          ],
        },
      ],
    };

    const config = changeSeriesColorConfigFactory(label, 'blue', existingConfig);

    expect(config.overrides).toHaveLength(1);
    expect(config.overrides[0].properties).toHaveLength(1);
    expect(config.overrides[0].properties[0].value.fixedColor).toBe('blue');
    expect(existingConfig.overrides[0].properties[0].value.fixedColor).toBe('green');
  });

  it('should create config override to change color for serie when override exists for other series', () => {
    const label = 'temperature';
    const color = 'green';

    const existingConfig: FieldConfigSource = {
      defaults: {},
      overrides: [
        {
          matcher: {
            id: FieldMatcherID.byName,
            options: 'humidity',
          },
          properties: [
            {
              id: 'color',
              value: {
                mode: FieldColorModeId.Fixed,
                fixedColor: color,
              },
            },
          ],
        },
      ],
    };

    const config = changeSeriesColorConfigFactory(label, color, existingConfig);

    expect(config).toEqual({
      defaults: {},
      overrides: [
        {
          matcher: {
            id: FieldMatcherID.byName,
            options: 'humidity',
          },
          properties: [
            {
              id: 'color',
              value: {
                mode: FieldColorModeId.Fixed,
                fixedColor: color,
              },
            },
          ],
        },
        {
          matcher: {
            id: FieldMatcherID.byName,
            options: label,
          },
          properties: [
            {
              id: 'color',
              value: {
                mode: FieldColorModeId.Fixed,
                fixedColor: color,
              },
            },
          ],
        },
      ],
    });
  });
});
