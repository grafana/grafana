import { FieldDisplay, createTheme, FieldType } from '@grafana/data';

import { applyDisplayOverrides } from './override';

describe('formatting functions', () => {
  describe('formatDisplayValuesWithCustomUnits', () => {
    const replace = (v: string) => v;
    const theme = createTheme();
    const mockSharedFieldValueProps: FieldDisplay = {
      name: 'name',
      field: {}, // field config
      hasLinks: false,
      display: {
        color: '#F2495C',
        numeric: 95.13749301705772,
        percent: 0.5197488596479736,
        prefix: '$',
        suffix: '%',
        text: '95.1',
        title: 'A-series',
        valueType: FieldType.number,
      },
    };

    it('passes the untouched field values through if no overrides present', () => {
      const out = applyDisplayOverrides(mockSharedFieldValueProps, theme, replace, [FieldType.number]);

      // toEqual() recursively checks every field of an object or array for equality
      expect(out).toEqual(mockSharedFieldValueProps);
    });

    it('sucessfully prepends the `display.prefix` value with the custom prefix, and leave the suffix unchanged', () => {
      const out = applyDisplayOverrides(
        {
          ...mockSharedFieldValueProps,
          field: {
            custom: {
              prefix: 'X',
              suffix: '',
              text: null,
            },
          },
        },
        theme,
        replace,
        [FieldType.number]
      );
      expect(out.display.prefix).toBe('X');
      expect(out.display.suffix).toBe(mockSharedFieldValueProps.display.suffix);
      expect(out.display.text).toBe(mockSharedFieldValueProps.display.text);
    });

    it('sucessfully appends the `display.suffix` value with the custom suffix, and leaves the prefix unchanged', () => {
      const out = applyDisplayOverrides(
        {
          ...mockSharedFieldValueProps,
          field: {
            custom: {
              prefix: '',
              suffix: '&',
              text: null,
            },
          },
        },
        theme,
        replace,
        [FieldType.number]
      );
      expect(out.display.suffix).toBe('&');
      expect(out.display.prefix).toBe(mockSharedFieldValueProps.display.prefix);
      expect(out.display.text).toBe(mockSharedFieldValueProps.display.text);
    });

    it('sucessfully formats both the prefix and the suffix', () => {
      const out = applyDisplayOverrides(
        {
          ...mockSharedFieldValueProps,
          field: {
            custom: {
              prefix: '@',
              suffix: '*',
              text: 'test',
            },
          },
        },
        theme,
        replace,
        [FieldType.number]
      );
      expect(out.display.prefix).toBe('@');
      expect(out.display.suffix).toBe('*');
      expect(out.display.text).toBe('test');
    });

    it('sucessfully ignores applying formatting to unspecified types', () => {
      // Override `FieldType.number with FieldType.time, which is not specified in the `applyToType` array arg
      const updatedMocData = {
        ...mockSharedFieldValueProps,
        display: { ...mockSharedFieldValueProps.display, valueType: FieldType.time },
      };

      const out = applyDisplayOverrides(updatedMocData, theme, replace, [FieldType.number]);

      // toEqual() recursively checks every field of an object or array for equality
      expect(out).toEqual(updatedMocData);
    });
  });
});
