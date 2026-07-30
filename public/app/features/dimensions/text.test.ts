import { type DataFrame, type DisplayProcessor, FieldType, toDataFrame } from '@grafana/data';
import { type TextDimensionConfig, TextDimensionMode } from '@grafana/schema';

import { getTextDimension } from './text';

function makeFrame(values: unknown[], type = FieldType.string, name = 'label'): DataFrame {
  return toDataFrame({
    fields: [{ name, type, values }],
  });
}

describe('text dimension', () => {
  describe('fixed mode', () => {
    it('returns the fixed string and is not assumed when set', () => {
      const dim = getTextDimension(undefined, {
        mode: TextDimensionMode.Fixed,
        fixed: 'hello',
        field: '',
      });
      expect(dim.value()).toBe('hello');
      expect(dim.get(0)).toBe('hello');
      expect(dim.isAssumed).toBe(false);
    });

    it('is assumed when the fixed string is empty', () => {
      const dim = getTextDimension(undefined, {
        mode: TextDimensionMode.Fixed,
        fixed: '',
        field: '',
      });
      expect(dim.isAssumed).toBe(true);
    });
  });

  describe('template mode', () => {
    it('wraps each field value in the TEMPLATE[fixed // value] form', () => {
      const dim = getTextDimension(makeFrame(['a', 'b']), {
        mode: TextDimensionMode.Template,
        fixed: 'pre',
        field: 'label',
      });
      expect(dim.get(0)).toBe('TEMPLATE[pre // a]');
      expect(dim.get(1)).toBe('TEMPLATE[pre // b]');
    });

    it('templates an empty value and is assumed when no field resolves', () => {
      const dim = getTextDimension(undefined, {
        mode: TextDimensionMode.Template,
        fixed: 'pre',
        field: '',
      });
      expect(dim.value()).toBe('TEMPLATE[pre // ]');
      expect(dim.isAssumed).toBe(true);
    });
  });

  describe('field mode', () => {
    it('renders the field display value per index', () => {
      const frame = makeFrame(['x', 'y']);
      const display: DisplayProcessor = (v) => ({ text: `<${v}>`, numeric: NaN });
      frame.fields[0].display = display;

      const dim = getTextDimension(frame, {
        mode: TextDimensionMode.Field,
        fixed: '',
        field: 'label',
      });
      expect(dim.get(0)).toBe('<x>');
      // value() reads the last non-null field value
      expect(dim.value()).toBe('<y>');
    });

    it('auto-selects the first string field when no field name is configured', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'num', type: FieldType.number, values: [1, 2] },
          { name: 'str', type: FieldType.string, values: ['a', 'b'] },
        ],
      });
      frame.fields[1].display = (v) => ({ text: `S:${v}`, numeric: NaN });

      const dim = getTextDimension(frame, {
        mode: TextDimensionMode.Field,
        fixed: '',
        field: '',
      });
      expect(dim.field?.name).toBe('str');
      expect(dim.get(0)).toBe('S:a');
    });

    it('is assumed and returns the fixed fallback when no field resolves', () => {
      const dim = getTextDimension(undefined, {
        mode: TextDimensionMode.Field,
        fixed: 'fallback',
        field: '',
      } as TextDimensionConfig);
      expect(dim.value()).toBe('fallback');
      expect(dim.isAssumed).toBe(true);
    });
  });
});
