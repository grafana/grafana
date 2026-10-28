import { type TraceSpan } from '../../../types/trace';

import { getSpanException } from './span-exception';

function spanWith(overrides: Partial<TraceSpan>): TraceSpan {
  return {
    spanID: 'span-1',
    traceID: 'trace-1',
    processID: 'p1',
    operationName: 'op',
    startTime: 0,
    duration: 1,
    logs: [],
    tags: [],
    flags: 0,
    depth: 0,
    hasChildren: false,
    childSpanCount: 0,
    process: { serviceName: 'svc', tags: [] },
    relativeStartTime: 0,
    references: [],
    warnings: [],
    childSpanIds: [],
    subsidiarilyReferencedBy: [],
    ...overrides,
  };
}

describe('getSpanException', () => {
  it('returns undefined when the span has no exception fields', () => {
    expect(
      getSpanException(
        spanWith({
          logs: [{ timestamp: 1, fields: [{ key: 'message', value: 'ok' }] }],
          tags: [{ key: 'http.status_code', value: 503 }],
        })
      )
    ).toBeUndefined();
  });

  it('reads type, message, and stacktrace from an exception event', () => {
    expect(
      getSpanException(
        spanWith({
          logs: [
            {
              timestamp: 10,
              name: 'exception',
              fields: [
                { key: 'exception.type', value: 'java.lang.NullPointerException' },
                { key: 'exception.message', value: 'Cannot invoke User.getId()' },
                { key: 'exception.stacktrace', value: 'at UserService.getUserId' },
              ],
            },
          ],
        })
      )
    ).toEqual({
      type: 'java.lang.NullPointerException',
      message: 'Cannot invoke User.getId()',
      stacktrace: 'at UserService.getUserId',
    });
  });

  it('fills missing fields from span tags when an event omits them', () => {
    expect(
      getSpanException(
        spanWith({
          logs: [
            {
              timestamp: 10,
              name: 'exception',
              fields: [{ key: 'exception.message', value: 'from event' }],
            },
          ],
          tags: [
            { key: 'exception.type', value: 'TimeoutError' },
            { key: 'exception.message', value: 'from tag' },
          ],
        })
      )
    ).toEqual({
      type: 'TimeoutError',
      message: 'from event',
    });
  });
});
