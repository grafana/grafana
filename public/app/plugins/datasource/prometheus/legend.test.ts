import { Labels } from '@grafana/data';
import { renderLegendFormat } from './legend';

describe('renderLegendFormat()', () => {
  const labels = {
    a: 'AAA',
    b: 'BBB',
    'with space': 'CCC',
  };

  it('works without any labels', () => {
    expect(renderLegendFormat('hello', {})).toEqual('hello');
    expect(renderLegendFormat('hello', labels)).toEqual('hello');
  });

  it('Simple replace', () => {
    expect(renderLegendFormat('value: {{a}}', labels)).toEqual('value: AAA');
    expect(renderLegendFormat('{{a}} {{with space}}', labels)).toEqual('AAA CCC');

    // not sure if this is expected... but current behavior
    expect(renderLegendFormat('{{ a }}', labels)).toEqual('AAA');
  });

  it('Bad syntax', () => {
    expect(renderLegendFormat('value: {{a}', labels)).toEqual('value: {{a}');
    expect(renderLegendFormat('value: {a}}}', labels)).toEqual('value: {a}}}');
    expect(renderLegendFormat('{{}}', labels)).toEqual('{{}}');
    expect(renderLegendFormat('{{{{a', labels)).toEqual('{{{{a');
    expect(renderLegendFormat('value: {{{a}}}', labels)).toEqual('value: {{{a}}}');
  });

  // Same behavior as regexp
  describe('check beavior vs long time regexp version', () => {
    test.each([
      [
        '{{a}}',
        '{{a}} {{a}}',
        '{{a}} {{a',
        '{{with space}}',
        '{{$a}}',
        '{{nope}}',
        '{{xx}}',

        // Questionable, but consistent
        '{{ a }}',
      ],
    ])('should behave like original regexp version', (pattern) => {
      let now = renderLegendFormat(pattern, labels);
      let old = originalLegendRenderer(pattern, labels);
      expect(now).toEqual(old);

      // When labels are empty the behavior is slightly different
      now = renderLegendFormat(pattern, {});
      old = originalLegendRenderer(pattern, {});
      expect(now).toEqual(old);
    });

    // Changed, but OK
    test.each([
      [
        // Before, it became `{a}`, now `{{{a}}}`
        'value: {{{a}}}',
      ],
    ])('should behave like original regexp version', (pattern) => {
      const now = renderLegendFormat(pattern, labels);
      const old = originalLegendRenderer(pattern, labels);
      expect(now).not.toEqual(old);
    });
  });
});

function originalLegendRenderer(aliasPattern: string, aliasData: Labels): string {
  const aliasRegex = /\{\{\s*(.+?)\s*\}\}/g;
  return aliasPattern.replace(aliasRegex, (_, g1) => (aliasData[g1] ? aliasData[g1] : g1));
}
