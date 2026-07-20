import { attributeToTraceQLFilter } from './traceQLFilter';

describe('attributeToTraceQLFilter', () => {
  it('builds a filter for a simple string span attribute', () => {
    expect(attributeToTraceQLFilter({ key: 'http.status_code', value: '200' }, 'span')).toBe(
      'span.http.status_code = "200"'
    );
  });

  it('builds a filter for a numeric attribute without quoting the value', () => {
    expect(attributeToTraceQLFilter({ key: 'http.status_code', value: 200 }, 'span')).toBe(
      'span.http.status_code = 200'
    );
  });

  it('builds a filter for a resource attribute', () => {
    expect(attributeToTraceQLFilter({ key: 'service.name', value: 'checkout' }, 'resource')).toBe(
      'resource.service.name = "checkout"'
    );
  });

  it('builds a filter for a boolean attribute without quoting the value', () => {
    expect(attributeToTraceQLFilter({ key: 'error', value: true }, 'span')).toBe('span.error = true');
  });

  it('quotes keys containing spaces or other non-bare characters', () => {
    expect(attributeToTraceQLFilter({ key: 'attribute name with space', value: 'x' }, 'span')).toBe(
      'span."attribute name with space" = "x"'
    );
  });

  it('escapes double quotes in a quoted key', () => {
    expect(attributeToTraceQLFilter({ key: 'weird "key"', value: 'x' }, 'span')).toBe('span."weird \\"key\\"" = "x"');
  });

  it('quotes keys with leading, trailing, or doubled dots that are not valid bare identifiers', () => {
    expect(attributeToTraceQLFilter({ key: 'foo.', value: 'x' }, 'span')).toBe('span."foo." = "x"');
    expect(attributeToTraceQLFilter({ key: '.foo', value: 'x' }, 'span')).toBe('span.".foo" = "x"');
    expect(attributeToTraceQLFilter({ key: 'a..b', value: 'x' }, 'span')).toBe('span."a..b" = "x"');
  });

  it('quotes dotted keys whose segments start with a digit', () => {
    expect(attributeToTraceQLFilter({ key: 'http.2xx', value: 'x' }, 'span')).toBe('span."http.2xx" = "x"');
  });

  it('keeps valid multi-segment dotted keys bare', () => {
    expect(attributeToTraceQLFilter({ key: 'k8s.pod.name', value: 'checkout' }, 'resource')).toBe(
      'resource.k8s.pod.name = "checkout"'
    );
  });

  it('escapes double quotes in a string value', () => {
    expect(attributeToTraceQLFilter({ key: 'foo', value: 'say "hi"' }, 'span')).toBe('span.foo = "say \\"hi\\""');
  });

  it('escapes backslashes in a string value', () => {
    expect(attributeToTraceQLFilter({ key: 'foo', value: 'C:\\path' }, 'span')).toBe('span.foo = "C:\\\\path"');
  });

  it('escapes newlines in a string value to match the Tempo datasource escaping', () => {
    expect(attributeToTraceQLFilter({ key: 'foo', value: 'line1\nline2' }, 'span')).toBe('span.foo = "line1\\nline2"');
  });

  it('returns null for object/array values TraceQL cannot compare against', () => {
    expect(attributeToTraceQLFilter({ key: 'foo', value: { nested: true } }, 'span')).toBeNull();
    expect(attributeToTraceQLFilter({ key: 'foo', value: [1, 2, 3] }, 'span')).toBeNull();
  });

  it('returns null when the key is empty', () => {
    expect(attributeToTraceQLFilter({ key: '', value: 'x' }, 'span')).toBeNull();
  });
});
