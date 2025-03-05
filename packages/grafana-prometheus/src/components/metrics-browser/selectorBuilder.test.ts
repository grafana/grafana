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
    });
  });
});
