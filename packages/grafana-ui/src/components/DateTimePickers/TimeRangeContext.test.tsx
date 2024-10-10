import { act, render } from '@testing-library/react';
import { useEffect } from 'react';

import { makeTimeRange } from '@grafana/data';

import { TimeRangeContextHookValue, TimeRangeProvider, useTimeRangeContext } from './TimeRangeContext';

describe('TimeRangeProvider', () => {
  it('provides the context with default values', () => {
    let context: TimeRangeContextHookValue | undefined = undefined;
    function onContextChange(val?: TimeRangeContextHookValue) {
      context = val;
    }

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
    let context: TimeRangeContextHookValue | undefined = undefined;
    function onContextChange(val?: TimeRangeContextHookValue) {
      context = val;
    }

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
    let context1: TimeRangeContextHookValue | undefined = undefined;
    function onContextChange1(val?: TimeRangeContextHookValue) {
      context1 = val;
    }

    let context2: TimeRangeContextHookValue | undefined = undefined;
    function onContextChange2(val?: TimeRangeContextHookValue) {
      context2 = val;
    }

    render(
      <TimeRangeProvider>
        <TestComponent onContextChange={onContextChange1} />
        <TestComponent onContextChange={onContextChange2} />
      </TimeRangeProvider>
    );

    const timeRange = makeTimeRange('2021-01-01', '2021-01-02');
    act(() => {
      context1?.sync(timeRange);
    });

    expect(context2).toMatchObject({
      syncPossible: true,
      synced: true,
      syncedValue: timeRange,
    });

    act(() => {
      context1?.unSync();
    });

    expect(context2).toMatchObject({
      syncPossible: true,
      synced: false,
      syncedValue: undefined,
    });
  });
});

describe('useTimeRangeContext', () => {
  it('does not error without provider', () => {
    let context: TimeRangeContextHookValue | undefined = undefined;
    function onContextChange(val?: TimeRangeContextHookValue) {
      context = val;
    }
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
