import { act, render } from '@testing-library/react';
import { useEffect } from 'react';

import { makeTimeRange } from '@grafana/data';

import { TimeRangeContextHookValue, TimeRangeProvider, useTimeRangeContext } from './TimeRangeContext';

// Should be fine to have this globally as single file should not be parallelized
let context: TimeRangeContextHookValue | undefined = undefined;
function onContextChange(val?: TimeRangeContextHookValue) {
  context = val;
}

describe('TimeRangeProvider', () => {
  it('provides the context with default values', () => {
    render(
      <TimeRangeProvider>
        <TestComponent onContextChange={onContextChange} />
      </TimeRangeProvider>
    );

    expect(context).toMatchObject({
      sync: expect.any(Function),
      unSync: expect.any(Function),
      syncPossible: false,
      synced: false,
      syncedValue: undefined,
    });
  });

  it('is possible to sync if 2 instances exist', async () => {
    render(
      <TimeRangeProvider>
        <TestComponent onContextChange={onContextChange} />
        <TestComponent onContextChange={() => {}} />
      </TimeRangeProvider>
    );

    expect(context).toMatchObject({
      sync: expect.any(Function),
      unSync: expect.any(Function),
      syncPossible: true,
      synced: false,
      syncedValue: undefined,
    });
  });

  it('syncs and unsyncs time across instances', async () => {
    let context2: TimeRangeContextHookValue | undefined = undefined;
    function onContextChange2(val?: TimeRangeContextHookValue) {
      context2 = val;
    }

    render(
      <TimeRangeProvider>
        <TestComponent onContextChange={onContextChange} />
        <TestComponent onContextChange={onContextChange2} />
      </TimeRangeProvider>
    );

    const timeRange = makeTimeRange('2021-01-01', '2021-01-02');
    act(() => {
      context?.sync(timeRange);
    });

    expect(context2).toMatchObject({
      syncPossible: true,
      synced: true,
      syncedValue: timeRange,
    });

    act(() => {
      context?.unSync();
    });

    expect(context2).toMatchObject({
      syncPossible: true,
      synced: false,
      syncedValue: undefined,
    });
  });

  it('sets status to not synced if only 1 component remains', async () => {
    let context2: TimeRangeContextHookValue | undefined = undefined;
    function onContextChange2(val?: TimeRangeContextHookValue) {
      context2 = val;
    }

    const { rerender } = render(
      <TimeRangeProvider>
        <TestComponent onContextChange={onContextChange} />
        <TestComponent onContextChange={onContextChange2} />
      </TimeRangeProvider>
    );

    const timeRange = makeTimeRange('2021-01-01', '2021-01-02');
    act(() => {
      context?.sync(timeRange);
    });

    expect(context2).toMatchObject({
      syncPossible: true,
      synced: true,
      syncedValue: timeRange,
    });

    rerender(
      <TimeRangeProvider>
        <TestComponent onContextChange={onContextChange2} />
      </TimeRangeProvider>
    );

    expect(context2).toMatchObject({
      syncPossible: false,
      synced: false,
      syncedValue: undefined,
    });
  });
});

describe('useTimeRangeContext', () => {
  it('does not error without provider', () => {
    render(<TestComponent onContextChange={onContextChange} />);
    expect(context).toBeUndefined();
  });
});

type TestComponentProps = {
  onContextChange: (context?: TimeRangeContextHookValue) => void;
};

function TestComponent(props: TestComponentProps) {
  const context = useTimeRangeContext();
  useEffect(() => {
    props.onContextChange(context);
  }, [context, props]);
  return null;
}
