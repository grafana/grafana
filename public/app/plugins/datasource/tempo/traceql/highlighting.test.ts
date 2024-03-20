import { monacoTypes } from '@grafana/ui';

import { computeErrorMessage, getErrorNodes, getWarningMarkers } from './highlighting';

describe('Highlighting', () => {
  describe('gets correct warning markers for', () => {
    const message = 'Add resource or span scope to attribute to improve query performance.';

    describe('no warnings', () => {
      it('for span scope', () => {
        const { model } = setup('{ span.component = "http" }');
        const marker = getWarningMarkers(4, model);
        expect(marker).toEqual(expect.objectContaining([]));
      });
      it('for resource scope', () => {
        const { model } = setup('{ resource.component = "http" }');
        const marker = getWarningMarkers(4, model);
        expect(marker).toEqual(expect.objectContaining([]));
      });
      it('for parent scope', () => {
        const { model } = setup('{ parent.component = "http" }');
        const marker = getWarningMarkers(4, model);
        expect(marker).toEqual(expect.objectContaining([]));
      });
    });

    it('single warning', () => {
      const { model } = setup('{ .component = "http" }');
      const marker = getWarningMarkers(4, model);
      expect(marker).toEqual(
        expect.objectContaining([
          {
            message,
            severity: 4,
            startLineNumber: 1,
            endLineNumber: 1,
            startColumn: 3,
            endColumn: 3,
          },
        ])
      );
    });

    it('multiple warnings', () => {
      const { model } = setup('{ .component = "http" || .http.status_code = 200 }');
      const marker = getWarningMarkers(4, model);
      expect(marker).toEqual(
        expect.objectContaining([
          {
            message,
            severity: 4,
            startLineNumber: 1,
            endLineNumber: 1,
            startColumn: 3,
            endColumn: 3,
          },
          {
            message,
            severity: 4,
            startLineNumber: 1,
            endLineNumber: 1,
            startColumn: 26,
            endColumn: 26,
          },
        ])
      );
    });

    it('multiple parts, single warning', () => {
      const { model } = setup('{ resource.component = "http" || .http.status_code = 200 }');
      const marker = getWarningMarkers(4, model);
      expect(marker).toEqual(
        expect.objectContaining([
          {
            message,
            severity: 4,
            startLineNumber: 1,
            endLineNumber: 1,
            startColumn: 34,
            endColumn: 34,
          },
        ])
      );
    });
  });

  describe('check for syntax errors in query', () => {
    it.each([
      ['{span.http.status_code = }', 'Invalid value after comparison or arithmetic operator.'],
      ['{span.http.status_code 200}', 'Invalid comparison operator after field expression.'],
      ['{span.http.status_code ""}', 'Invalid operator after field expression.'],
      ['{span.http.status_code @ 200}', 'Invalid comparison operator after field expression.'],
      ['{span.http.status_code span.http.status_code}', 'Invalid operator after field expression.'],
      [
        '{span.http.status_code = 200} {span.http.status_code = 200}',
        'Invalid spanset combining operator after spanset expression.',
      ],
      [
        '{span.http.status_code = 200} + {span.http.status_code = 200}',
        'Invalid spanset combining operator after spanset expression.',
      ],
      ['{span.http.status_code = 200} &&', 'Invalid spanset expression after spanset combining operator.'],
      [
        '{span.http.status_code = 200} && {span.http.status_code = 200} | foo() > 3',
        'Invalid aggregation operator after pipepile operator.',
      ],
      [
        '{span.http.status_code = 200} && {span.http.status_code = 200} | avg() > 3',
        'Invalid expression for aggregator operator.',
      ],
      ['{ 1 + 1 = 2 + }', 'Invalid value after comparison or arithmetic operator.'],
      ['{ .a && }', 'Invalid value after logical operator.'],
      ['{ .a || }', 'Invalid value after logical operator.'],
      ['{ .a + }', 'Invalid value after comparison or arithmetic operator.'],
      ['{ 200 = 200 200 }', 'Invalid comparison operator after field expression.'],
      ['{.foo   300}', 'Invalid comparison operator after field expression.'],
      ['{.foo  300 && .bar = 200}', 'Invalid operator after field expression.'],
      ['{.foo  300 && .bar  200}', 'Invalid operator after field expression.'],
      ['{.foo=1}  {.bar=2}', 'Invalid spanset combining operator after spanset expression.'],
      ['{ span.http.status_code = 200 &&  }', 'Invalid value after logical operator.'],
      ['{ span.http.status_code = 200 ||  }', 'Invalid value after logical operator.'],
      ['{ .foo = 200 } && ', 'Invalid spanset expression after spanset combining operator.'],
      ['{ .foo = 200 } || ', 'Invalid spanset expression after spanset combining operator.'],
      ['{ .foo = 200 } >> ', 'Invalid spanset expression after spanset combining operator.'],
      ['{.foo=1} | avg()', 'Invalid expression for aggregator operator.'],
      ['{.foo=1} | avg(.foo) > ', 'Invalid value after comparison operator.'],
      ['{.foo=1} | avg() < 1s', 'Invalid expression for aggregator operator.'],
      ['{.foo=1} | max() = 3', 'Invalid expression for aggregator operator.'],
      ['{.foo=1} | by()', 'Invalid expression for by operator.'],
      ['{.foo=1} | select()', 'Invalid expression for select operator.'],
      ['{foo}', 'Invalid expression for spanset.'],
      ['{.}', 'Invalid expression for spanset.'],
      ['{ resource. }', 'Invalid expression for spanset.'],
      ['{ span. }', 'Invalid expression for spanset.'],
      ['{.foo=}', 'Invalid value after comparison or arithmetic operator.'],
      ['{.foo="}', 'Invalid value after comparison or arithmetic operator.'],
      ['{.foo=300} |', 'Invalid aggregation operator after pipepile operator.'],
      ['{.foo=300} && {.bar=200} |', 'Invalid aggregation operator after pipepile operator.'],
      ['{.foo=300} && {.bar=300} && {.foo=300} |', 'Invalid aggregation operator after pipepile operator.'],
      ['{.foo=300} | avg(.value)', 'Invalid comparison operator after aggregator operator.'],
      ['{.foo=300} && {.foo=300} | avg(.value)', 'Invalid comparison operator after aggregator operator.'],
      ['{.foo=300} | avg(.value) =', 'Invalid value after comparison operator.'],
      ['{.foo=300} && {.foo=300} | avg(.value) =', 'Invalid value after comparison operator.'],
      ['{.foo=300} | max(duration) > 1hs', 'Invalid value after comparison operator.'],
      ['{ span.http.status_code', 'Invalid comparison operator after field expression.'],
      ['{ .foo = "bar"', 'Invalid comparison operator after field expression.'],
      ['abcxyz', 'Invalid query.'],
    ])('error message for invalid query - %s, %s', (query: string, expectedErrorMessage: string) => {
      const errorNode = getErrorNodes(query)[0];
      expect(computeErrorMessage(errorNode)).toBe(expectedErrorMessage);
    });

    it.each([
      ['123'],
      ['abc'],
      ['1a2b3c'],
      ['{span.status = $code}'],
      ['{span.${attribute} = "GET"}'],
      ['{span.${attribute:format} = ${value:format} }'],
      ['{true} >> {true}'],
      ['{true} << {true}'],
      ['{true} !>> {true}'],
      ['{true} !<< {true}'],
      [
        `{ true } /* && { false } && */ && { true } // && { false }
      && { true }`,
      ],
      ['{span.s"t\\"at"us}'],
      ['{span.s"t\\\\at"us}'],
      ['{ span.s"tat"us" = "GET123 }'], // weird query, but technically valid
      ['{ duration = 123.456us}'],
      ['{ .foo = `GET` && .bar = `P\'O"S\\T` }'],
      ['{ .foo = `GET` } | by(.foo, name)'],
    ])('valid query - %s', (query: string) => {
      expect(getErrorNodes(query)).toStrictEqual([]);
    });
  });
});

function setup(value: string) {
  const model = makeModel(value);
  return { model } as unknown as { model: monacoTypes.editor.ITextModel };
}

function makeModel(value: string) {
  return {
    id: 'test_monaco',
    getValue() {
      return value;
    },
    getLineLength() {
      return value.length;
    },
  };
}
