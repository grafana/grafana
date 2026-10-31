import { shouldPinEventsFirst } from './spanDetailSectionOrder';

describe('shouldPinEventsFirst', () => {
  const exceptionLog = {
    name: 'exception',
    fields: [{ key: 'exception.message', value: 'boom' }],
  };
  const infoLog = {
    fields: [{ key: 'message', value: 'ok' }],
  };

  it('returns false when the span has no events', () => {
    expect(shouldPinEventsFirst({ statusCode: 2, logs: [] })).toBe(false);
    expect(shouldPinEventsFirst({ statusCode: 2 })).toBe(false);
  });

  it('returns false for a successful span with ordinary events', () => {
    expect(shouldPinEventsFirst({ statusCode: 1, logs: [infoLog] })).toBe(false);
    expect(shouldPinEventsFirst({ statusCode: 0, logs: [infoLog] })).toBe(false);
  });

  it('returns true when the span is in error and has events', () => {
    expect(shouldPinEventsFirst({ statusCode: 2, logs: [infoLog] })).toBe(true);
  });

  it('returns true when an event is an exception even if status is not error', () => {
    expect(shouldPinEventsFirst({ statusCode: 1, logs: [exceptionLog] })).toBe(true);
    expect(
      shouldPinEventsFirst({
        logs: [{ fields: [{ key: 'event', value: 'exception' }] }],
      })
    ).toBe(true);
  });
});
