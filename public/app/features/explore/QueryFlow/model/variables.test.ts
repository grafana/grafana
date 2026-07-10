import { mapSpanToOriginal, replaceVariables } from './variables';

describe('replaceVariables + mapSpanToOriginal', () => {
  it('replaces a $var with a parsable placeholder and maps its span back to source', () => {
    const expr = 'a $foo b';
    const { replaced, map } = replaceVariables(expr);
    expect(replaced).toBe('a __V_0__foo__V__ b');

    const repFrom = replaced.indexOf('__V_0__foo__V__');
    const repTo = repFrom + '__V_0__foo__V__'.length;
    const orig = mapSpanToOriginal({ from: repFrom, to: repTo }, map);
    expect(expr.slice(orig.from, orig.to)).toBe('$foo');
  });

  it('maps positions after a variable using the length delta', () => {
    const expr = 'rate(x[$__rate_interval])';
    const { replaced, map } = replaceVariables(expr);

    const repCloseParen = replaced.lastIndexOf(')');
    const origCloseParen = mapSpanToOriginal({ from: repCloseParen, to: repCloseParen + 1 }, map);
    expect(expr.slice(origCloseParen.from, origCloseParen.to)).toBe(')');
  });

  it('handles ${var} and [[var]] forms', () => {
    expect(replaceVariables('x{a="${ns}"}').replaced).toContain('__V_2__ns__V__');
    expect(replaceVariables('x{a="[[ns]]"}').replaced).toContain('__V_1__ns__V__');
  });

  it('is a no-op for queries without variables', () => {
    const { replaced, map } = replaceVariables('rate(metric[5m])');
    expect(replaced).toBe('rate(metric[5m])');
    expect(map.segments).toHaveLength(0);
  });

  it('uses the canonical [[var]] pattern (word chars only), matching app/features/variables/utils', () => {
    // Regression test: a locally-diverged regex accepted any character inside [[...]], so
    // `[[foo bar]]` (not a valid Grafana variable name — variables never contain spaces) was
    // incorrectly swept into a single placeholder instead of being left as ordinary query text.
    const { replaced } = replaceVariables('x{a="[[foo bar]]"}');
    expect(replaced).toBe('x{a="[[foo bar]]"}');
  });

  it('maps two independent variables in the same expression back to their own source spans', () => {
    const expr = 'x{a="$foo",b="$bar"}';
    const { replaced, map } = replaceVariables(expr);

    const firstFrom = replaced.indexOf('__V_0__foo__V__');
    const firstTo = firstFrom + '__V_0__foo__V__'.length;
    const secondFrom = replaced.indexOf('__V_0__bar__V__');
    const secondTo = secondFrom + '__V_0__bar__V__'.length;

    const first = mapSpanToOriginal({ from: firstFrom, to: firstTo }, map);
    const second = mapSpanToOriginal({ from: secondFrom, to: secondTo }, map);
    expect(expr.slice(first.from, first.to)).toBe('$foo');
    expect(expr.slice(second.from, second.to)).toBe('$bar');
  });

  it('maps adjacent variables with no separator without cross-contaminating their spans', () => {
    const expr = '$foo$bar';
    const { replaced, map } = replaceVariables(expr);

    const fooTo = replaced.indexOf('__V_0__foo__V__') + '__V_0__foo__V__'.length;
    const barFrom = fooTo;
    const barTo = barFrom + '__V_0__bar__V__'.length;

    const foo = mapSpanToOriginal({ from: 0, to: fooTo }, map);
    const bar = mapSpanToOriginal({ from: barFrom, to: barTo }, map);
    expect(expr.slice(foo.from, foo.to)).toBe('$foo');
    expect(expr.slice(bar.from, bar.to)).toBe('$bar');
  });

  it('clamps a span landing inside a placeholder to the original variable bounds', () => {
    const expr = 'a $foo b';
    const { replaced, map } = replaceVariables(expr);
    const placeholder = '__V_0__foo__V__';
    const repFrom = replaced.indexOf(placeholder);

    // A span starting and ending mid-placeholder should clamp to the whole `$foo` token, not some
    // arbitrary substring of the internal placeholder encoding.
    const span = mapSpanToOriginal({ from: repFrom + 2, to: repFrom + 5 }, map);
    expect(expr.slice(span.from, span.to)).toBe('$foo');
  });

  it('leaves a span entirely before any variable unshifted', () => {
    const expr = 'a $foo b';
    const { map } = replaceVariables(expr);
    expect(mapSpanToOriginal({ from: 0, to: 1 }, map)).toEqual({ from: 0, to: 1 });
  });

  it('handles a zero-width span at a placeholder boundary', () => {
    const expr = 'a $foo b';
    const { replaced, map } = replaceVariables(expr);
    const repFrom = replaced.indexOf('__V_0__foo__V__');
    const span = mapSpanToOriginal({ from: repFrom, to: repFrom }, map);
    // Maps to the original start of the variable (`$` in `$foo`), not shifted past it.
    expect(span).toEqual({ from: 2, to: 2 });
  });
});
