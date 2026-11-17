import { render, screen } from '@testing-library/react';

import { type TraceSpan, setScopeData } from '../../liveScenario';
import { emptyScopeData, sameKeyWarnings } from '../../testFixtures';

import { SpanWaterfallPanel } from './SpanWaterfallPanel';

const span = (startMs: number): TraceSpan => ({
  service: 'auth_api',
  operation: 'Memcache.Get',
  depth: 1,
  startMs,
  durationMs: 4,
  color: 'blue',
});

afterEach(() => {
  jest.restoreAllMocks();
  setScopeData(emptyScopeData);
});

describe('SpanWaterfallPanel', () => {
  it('shows a row for every call of an operation that a trace repeats, with no duplicate key warning', () => {
    setScopeData({
      ...emptyScopeData,
      trace: {
        ...emptyScopeData.trace,
        name: 'GET /login',
        durationMs: 40,
        spans: [span(0), span(10), span(20)],
      },
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<SpanWaterfallPanel />);

    expect(screen.getAllByText('Memcache.Get')).toHaveLength(3);
    expect(sameKeyWarnings(consoleError)).toEqual([]);
  });
});
