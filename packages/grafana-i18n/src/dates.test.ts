import { formatDate, initRegionalFormat } from './dates';

describe('grafana-i18n dates', () => {
  // Note: Date formatting depends on the browser/node I18n implementation which may change
  // between versions. Although these tests do assert on specific formatting, it's meant more
  // as snapshot-type tests to assert that the code broadly does the correct thing for its
  // arguments. As we change node versions, the assertions may need updating.

  it('formats a date with a different formatting options', () => {
    initRegionalFormat('en-US');

    const date = new Date('2025-08-25T02:34:56Z');
    const result = formatDate(date, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });

    expect(result).toBe('August 24, 2025 at 8:34:56 PM');
  });

  it('formats a date with a specific locale', () => {
    initRegionalFormat('de-DE');

    const date = new Date('2025-08-25T02:34:56Z');
    const result = formatDate(date, {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    expect(result).toBe('24.08.25, 20:34');
  });

  it("uses ISO-ish formatting when dateStyle is set to 'international'", () => {
    initRegionalFormat('en-US', 'international');

    const date = new Date('2025-08-25T02:34:56Z');
    const result = formatDate(date, {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    expect(result).toContain('2025-08-24'); // YYY-MM-DD
    expect(result).toBe('20:34'); // 24 hour time
  });
});
