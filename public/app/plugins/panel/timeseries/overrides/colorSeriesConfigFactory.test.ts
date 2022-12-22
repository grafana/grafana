import { FieldColorModeId, FieldConfigSource, FieldMatcherID } from '@grafana/data';

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
