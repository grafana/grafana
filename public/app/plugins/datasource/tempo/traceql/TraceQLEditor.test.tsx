import { computeErrorMessage, getErrorNodes } from './errorHighlighting';

describe('Check for syntax errors in query', () => {
  it.each([
    ['{span.http.status_code = }', 'Invalid value after comparison or aritmetic operator.'],
    ['{span.http.status_code 200}', 'Invalid comparison operator after field expression.'],
    ['{span.http.status_code ""}', 'Invalid comparison operator after field expression.'],
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
    ['{ 1 + 1 = 2 + }', 'Invalid value after comparison or aritmetic operator.'],
    ['{ .a && }', 'Invalid value after logical operator.'],
    ['{ .a || }', 'Invalid value after logical operator.'],
    ['{ .a + }', 'Invalid value after comparison or aritmetic operator.'],
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
    ['{.foo=1} | by()', 'Invalid expression for aggregator operator.'],
    ['{.foo=1} | select()', 'Invalid expression for aggregator operator.'],
    ['{foo}', 'Invalid expression for spanset.'],
    ['{.}', 'Invalid expression for spanset.'],
    ['{ resource. }', 'Invalid expression for spanset.'],
    ['{ span. }', 'Invalid expression for spanset.'],
    ['{.foo=}', 'Invalid value after comparison or aritmetic operator.'],
    ['{.foo="}', 'Invalid value after comparison or aritmetic operator.'],
    ['{.foo=300} |', 'Invalid aggregation operator after pipepile operator.'],
    ['{.foo=300} && {.bar=200} |', 'Invalid aggregation operator after pipepile operator.'],
    ['{.foo=300} && {.bar=300} && {.foo=300} |', 'Invalid aggregation operator after pipepile operator.'],
    ['{.foo=300} | avg(.value)', 'Invalid comparison operator after aggregator operator.'],
    ['{.foo=300} && {.foo=300} | avg(.value)', 'Invalid comparison operator after aggregator operator.'],
    ['{.foo=300} | avg(.value) =', 'Invalid value after comparison operator.'],
    ['{.foo=300} && {.foo=300} | avg(.value) =', 'Invalid value after comparison operator.'],
    ['{.foo=300} | max(duration) > 1hs', 'Invalid value after comparison operator.'],
    ['{ span.http.status_code', 'Invalid comparison operator after field expression.'],
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
  ])('valid query - %s', (query: string) => {
    expect(getErrorNodes(query)).toStrictEqual([]);
  });
});
