import {
  SOFT_BLOCK_MARKER,
  MIN_SOFT_BLOCK_REASON_LENGTH,
  SOFT_BLOCK_HEADER_NAMES,
  parseSoftBlockError,
  isValidSoftBlockReason,
  buildSoftBlockOverrideHeaders,
  collectSoftBlockTokens,
} from './softBlock';

// The human-readable part the gateway puts before the marker. The trailing agent-directed
// sentence is expected to be stripped from the parsed `text`.
const READABLE =
  'query range 2d exceeds the soft limit of 1d. Reduce the time range to 1d or less, or continue by retrying with a reason.';
const CONFIRM = 'Confirm with the user before retrying.';

const defaultJson = '{"code":"guardrail_soft_block","token":"abc.def"}';

describe('softBlock constants', () => {
  it('exposes the expected marker, minimum reason length and canonical header names', () => {
    expect(SOFT_BLOCK_MARKER).toBe('[guardrail_soft_block]');
    expect(MIN_SOFT_BLOCK_REASON_LENGTH).toBe(10);
    expect(SOFT_BLOCK_HEADER_NAMES).toEqual({
      token: 'X-Grafana-Guardrail-Override',
      reason: 'X-Grafana-Guardrail-Override-Reason',
    });
  });
});

describe('parseSoftBlockError', () => {
  it('parses a valid soft-block message and strips the Confirm-with-user sentence', () => {
    const message = `${READABLE} ${CONFIRM} ${SOFT_BLOCK_MARKER} ${defaultJson}`;

    const parsed = parseSoftBlockError(message);

    expect(parsed).not.toBeNull();
    expect(parsed!.text).toBe(READABLE);
    expect(parsed!.text).not.toContain(CONFIRM);
    expect(parsed!.text).not.toContain(SOFT_BLOCK_MARKER);
    expect(parsed!.text).not.toContain('token');
    expect(parsed!.token).toBe('abc.def');
  });

  it('preserves trailing text (such as a Trace ID line) on a new line after the JSON object', () => {
    const message = `${READABLE} ${CONFIRM} ${SOFT_BLOCK_MARKER} ${defaultJson}\n(Trace ID: 64a1bc6c40f7b9e12eb2153d1112d952)`;

    const parsed = parseSoftBlockError(message);

    expect(parsed).not.toBeNull();
    expect(parsed!.text).toBe(`${READABLE}\n(Trace ID: 64a1bc6c40f7b9e12eb2153d1112d952)`);
    expect(parsed!.token).toBe('abc.def');
  });

  it('parses the gateway time-range message (typographic apostrophe) and keeps the Trace ID line', () => {
    const readable =
      'This query’s time range is longer than the 3-day limit. Shorten it to 3 days or less, or continue and enter a reason.';
    const message = `${readable} ${CONFIRM} ${SOFT_BLOCK_MARKER} ${defaultJson}\n(Trace ID: abc)`;

    const parsed = parseSoftBlockError(message);

    expect(parsed).not.toBeNull();
    expect(parsed!.text).toBe(`${readable}\n(Trace ID: abc)`);
    expect(parsed!.text).not.toContain(CONFIRM);
    expect(parsed!.token).toBe('abc.def');
  });

  it('respects strings/escapes in a brace-balanced scan (braces and quotes inside the token)', () => {
    // token contains an escaped quote and a literal brace; a naive regex to end-of-string or a
    // non-string-aware brace count would get this wrong.
    const json = '{"code":"guardrail_soft_block","token":"a\\"b}c.def"}';
    const message = `${READABLE} ${SOFT_BLOCK_MARKER} ${json}\n(Trace ID: xyz)`;

    const parsed = parseSoftBlockError(message);

    expect(parsed).not.toBeNull();
    expect(parsed!.token).toBe('a"b}c.def');
    expect(parsed!.text).toBe(`${READABLE}\n(Trace ID: xyz)`);
  });

  it('ignores header names supplied by the server', () => {
    const json =
      '{"code":"guardrail_soft_block","token":"tkn","headers":{"token":"X-Custom-Token","reason":"X-Custom-Reason"}}';
    const parsed = parseSoftBlockError(`${READABLE} ${SOFT_BLOCK_MARKER} ${json}`);

    expect(parsed).not.toBeNull();
    expect(parsed!.token).toBe('tkn');
    // The parsed result exposes no header names; the canonical names are always used downstream.
    expect(parsed).not.toHaveProperty('headerNames');
  });

  it('returns null for undefined', () => {
    expect(parseSoftBlockError(undefined)).toBeNull();
  });

  it('returns null when there is no marker', () => {
    expect(parseSoftBlockError('just a normal error message')).toBeNull();
  });

  it('returns null when the marker is present but no JSON follows', () => {
    expect(parseSoftBlockError(`${READABLE} ${SOFT_BLOCK_MARKER}`)).toBeNull();
  });

  it('returns null for malformed JSON after the marker', () => {
    expect(parseSoftBlockError(`${READABLE} ${SOFT_BLOCK_MARKER} {not valid json`)).toBeNull();
  });

  it('returns null when the code is not guardrail_soft_block', () => {
    const json = '{"code":"something_else","token":"tkn"}';
    expect(parseSoftBlockError(`${READABLE} ${SOFT_BLOCK_MARKER} ${json}`)).toBeNull();
  });

  it('returns null when the token is empty', () => {
    const json = '{"code":"guardrail_soft_block","token":""}';
    expect(parseSoftBlockError(`${READABLE} ${SOFT_BLOCK_MARKER} ${json}`)).toBeNull();
  });
});

describe('isValidSoftBlockReason', () => {
  it('is false for fewer than 10 characters after trimming', () => {
    expect(isValidSoftBlockReason('too short')).toBe(false); // 9 chars
  });

  it('is false for whitespace-only input', () => {
    expect(isValidSoftBlockReason('              ')).toBe(false);
  });

  it('is true for exactly 10 characters after trimming', () => {
    expect(isValidSoftBlockReason('  abcdefghij  ')).toBe(true);
  });
});

describe('buildSoftBlockOverrideHeaders', () => {
  it('de-duplicates tokens preserving order, drops empties, joins with a comma and trims the reason', () => {
    const headers = buildSoftBlockOverrideHeaders(['abc', '', 'def', 'abc'], '  a valid reason  ');

    expect(headers).toEqual({
      'X-Grafana-Guardrail-Override': 'abc,def',
      'X-Grafana-Guardrail-Override-Reason': 'a valid reason',
    });
  });

  it('always uses the canonical header names', () => {
    const headers = buildSoftBlockOverrideHeaders(['t1'], 'some reason here');

    expect(headers).toEqual({
      'X-Grafana-Guardrail-Override': 't1',
      'X-Grafana-Guardrail-Override-Reason': 'some reason here',
    });
  });
});

describe('collectSoftBlockTokens', () => {
  it('returns deduplicated tokens across mixed errors', () => {
    const softA = `blocked A ${SOFT_BLOCK_MARKER} {"code":"guardrail_soft_block","token":"abc"}`;
    const softB = `blocked B ${SOFT_BLOCK_MARKER} {"code":"guardrail_soft_block","token":"def"}`;
    const softADup = `blocked A again ${SOFT_BLOCK_MARKER} {"code":"guardrail_soft_block","token":"abc"}`;

    const tokens = collectSoftBlockTokens([
      { message: softA },
      { message: 'an ordinary non-soft-block error' },
      { message: softB },
      { message: softADup },
      {},
    ]);

    expect(tokens).toEqual(['abc', 'def']);
  });

  it('returns no tokens when there are no soft-block errors', () => {
    expect(collectSoftBlockTokens([{ message: 'plain error' }, {}])).toEqual([]);
  });

  it('returns no tokens for undefined input', () => {
    expect(collectSoftBlockTokens(undefined)).toEqual([]);
  });
});
