import { FieldDisplay, createTheme } from '@grafana/data';

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
      },
    };

    it('passes the untouched field values through if no overrides present', () => {
      const out = applyDisplayOverrides(mockSharedFieldValueProps, theme, replace);

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
        replace
      );
      expect(out.display.prefix).toBe('X');
      expect(out.display.suffix).toBe(mockSharedFieldValueProps.display.suffix);
      expect(out.display.text).toBe(mockSharedFieldValueProps.display.text);
    });

    // it('sucessfully appends the `display.suffix` value with the custom suffix, and leaves the prefix unchanged', () => {
    //   const updatedFieldValues = formatDisplayValuesWithCustomUnits(mockFieldValues, {
    //     // Empty custom prefix
    //     prefix: '',
    //     suffix,
    //   });

    //   expect(updatedFieldValues[0].display.prefix).toBe(mockFieldValues[0].display.prefix);
    //   expect(updatedFieldValues[0].display.suffix).toBe('%*');
    // });

    // it('sucessfully formats both the prefix and the suffix', () => {
    //   const updatedFieldValues = formatDisplayValuesWithCustomUnits(mockFieldValues, {
    //     prefix,
    //     suffix,
    //   });

    //   expect(updatedFieldValues[0].display.prefix).toBe('&$');
    //   expect(updatedFieldValues[0].display.suffix).toBe('%*');
    // });

    // it('ignores any `fieldValues` that are non-numeric', () => {
    //   const updatedFieldValues = formatDisplayValuesWithCustomUnits(mockFieldValues, {
    //     prefix,
    //     suffix,
    //   });

    //   // Since the 1 and 2 index are NOT numeric FieldTypes, they should remain unchanged
    //   expect(updatedFieldValues[1]).toEqual(mockFieldValues[1]);
    //   expect(updatedFieldValues[2]).toEqual(mockFieldValues[2]);

    //   // 0 index, however should be updated/formatted
    //   expect(updatedFieldValues[0].display.prefix).toBe('&$');
    //   expect(updatedFieldValues[0].display.suffix).toBe('%*');
    // });

    // it('should handle prefixes and suffixes that are nullish in nature', () => {
    //   // Empty object
    //   const updatedFieldValues1 = formatDisplayValuesWithCustomUnits(mockFieldValues, {});

    //   expect(updatedFieldValues1[0].display.prefix).toBe('$');
    //   expect(updatedFieldValues1[0].display.suffix).toBe('%');

    //   // Object with props with undefined values
    //   const updatedFieldValues2 = formatDisplayValuesWithCustomUnits(mockFieldValues, {
    //     prefix: undefined,
    //     suffix: undefined,
    //   });

    //   expect(updatedFieldValues2[0].display.prefix).toBe('$');
    //   expect(updatedFieldValues2[0].display.suffix).toBe('%');
    // });
  });
});
