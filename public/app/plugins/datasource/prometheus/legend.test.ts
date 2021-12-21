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
    expect(renderLegendFormat('{{             a                        }}', labels)).toEqual('AAA');
  });

  it('Missing label', () => {
    expect(renderLegendFormat('value: {{c}}', labels)).toEqual('value: c');
  });

  it('Nested brackets', () => {
    expect(renderLegendFormat('{{{a}}}', labels)).toEqual('{AAA}');
    expect(renderLegendFormat('{{{{a}}}}', labels)).toEqual('{{AAA}}');
    expect(renderLegendFormat('{{ {{ a }} }}', labels)).toEqual('{{ AAA }}');
  });

  it('Bad syntax', () => {
    expect(renderLegendFormat('value: {{{a}', labels)).toEqual('value: {{{a}');
    expect(renderLegendFormat('value: {{a}', labels)).toEqual('value: {{a}');
    expect(renderLegendFormat('value: {a}', labels)).toEqual('value: {a}');
    expect(renderLegendFormat('value: {a}}}', labels)).toEqual('value: {a}}}');
    expect(renderLegendFormat('value: {a}}', labels)).toEqual('value: {a}}');
    expect(renderLegendFormat('value: { {a} }', labels)).toEqual('value: { {a} }');
    expect(renderLegendFormat('value: { {a}}}', labels)).toEqual('value: { {a}}}');
    expect(renderLegendFormat('{{        }}', labels)).toEqual('{{        }}');
    expect(renderLegendFormat('{{}}', labels)).toEqual('{{}}');
    expect(renderLegendFormat('{{{}} }', labels)).toEqual('{{{}} }');
    expect(renderLegendFormat('{{{}}}', labels)).toEqual('{{{}}}');
    expect(renderLegendFormat('{{a}d}}', labels)).toEqual('a}d');
  });
});
