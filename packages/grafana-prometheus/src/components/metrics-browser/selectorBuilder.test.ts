import { buildSelector } from './selectorBuilder';

describe('selectorBuilder', () => {
  describe('buildSelector()', () => {
    it('returns an empty selector for no labels', () => {
      expect(buildSelector('', {})).toEqual('{}');
    });

    it('returns an empty selector for selected labels with no values', () => {
      expect(buildSelector('', {})).toEqual('{}');
    });

    it('returns an empty selector for one selected label with no selected values', () => {
      expect(buildSelector('', {})).toEqual('{}');
    });

    it('returns a simple selector from a selected label with a selected value', () => {
      expect(buildSelector('', { foo: ['bar'] })).toEqual('{foo="bar"}');
    });

    it('metric selector without labels', () => {
      expect(buildSelector('foo', {})).toEqual('foo{}');
    });

    it('metric selector with labels', () => {
      expect(buildSelector('foo', { bar: ['baz'] })).toEqual('foo{bar="baz"}');
    });

    it('skips labels with empty value arrays', () => {
      expect(buildSelector('metric', { emptyLabel: [], validLabel: ['value'] })).toEqual('metric{validLabel="value"}');
    });

    it('handles multiple values for a label using regex matcher', () => {
      expect(buildSelector('', { multi: ['val1', 'val2', 'val3'] })).toEqual('{multi=~"val1|val2|val3"}');
    });

    it('properly escapes special characters in regex values', () => {
      expect(buildSelector('', { special: ['val*', 'val.', 'val+'] })).toEqual(
        '{special=~"val\\\\*|val\\\\.|val\\\\+"}'
      );
    });

    it('properly escapes double quotes in exact matcher', () => {
      expect(buildSelector('', { quoted: ['value"with"quotes'] })).toEqual('{quoted="value\\"with\\"quotes"}');
    });

    it('properly handles newlines in values', () => {
      expect(buildSelector('', { newline: ['value\nwith\nnewlines'] })).toEqual('{newline="value\\nwith\\nnewlines"}');
    });

    it('combines multiple labels properly', () => {
      expect(
        buildSelector('', {
          label1: ['value1'],
          label2: ['value2'],
          label3: ['value3'],
        })
      ).toEqual('{label1="value1",label2="value2",label3="value3"}');
    });

    it('combines single and multi-value labels correctly', () => {
      expect(
        buildSelector('', {
          single: ['value'],
          multi: ['val1', 'val2'],
        })
      ).toEqual('{single="value",multi=~"val1|val2"}');
    });

    describe('utf8 support', () => {
      it('metric selector with utf8 metric', () => {
        expect(buildSelector('utf8.metric', {})).toEqual('{"utf8.metric"}');
      });

      it('metric selector with utf8 labels', () => {
        expect(buildSelector('foo', { 'utf8.label': ['baz'] })).toEqual('foo{"utf8.label"="baz"}');
      });

      it('metric selector with utf8 labels and metrics', () => {
        expect(buildSelector('utf8.metric', { 'utf8.label': ['baz'] })).toEqual('{"utf8.metric","utf8.label"="baz"}');
      });

      it('metric selector with utf8 metric and with utf8/non-utf8 labels', () => {
        expect(
          buildSelector('utf8.metric', {
            'utf8.label': ['uuu'],
            bar: ['baz'],
          })
        ).toEqual('{"utf8.metric","utf8.label"="uuu",bar="baz"}');
      });

      it('metric selector with non-utf8 metric with utf8/non-utf8 labels', () => {
        expect(
          buildSelector('foo', {
            'utf8.label': ['uuu'],
            bar: ['baz'],
          })
        ).toEqual('foo{"utf8.label"="uuu",bar="baz"}');
      });

      it('handles utf8 characters in label values', () => {
        expect(buildSelector('', { label: ['值', '😀', '你好'] })).toEqual('{label=~"值|😀|你好"}');
      });
    });
  });
});
