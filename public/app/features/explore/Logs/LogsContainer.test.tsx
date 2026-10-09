import { act, render } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { dateTime, EventBusSrv, LoadingState, SupplementaryQueryType, type TimeRange } from '@grafana/data';
import { configureStore } from 'app/store/configureStore';

import { setSupplementaryQueryEnabled } from '../state/query';
import { changeRangeAction } from '../state/time';
import { makeExplorePaneState } from '../state/utils';

import { type Logs } from './Logs';
import LogsContainer from './LogsContainer';

type LogsProps = Parameters<typeof Logs>[0];

const mockLogsProps: LogsProps[] = [];

jest.mock('./Logs', () => ({
  Logs: (props: LogsProps) => {
    mockLogsProps.push(props);
    return null;
  },
}));

function getLastLogsProps(): LogsProps {
  return mockLogsProps[mockLogsProps.length - 1];
}

function makeRange(from: number, to: number): TimeRange {
  return { from: dateTime(from), to: dateTime(to), raw: { from: dateTime(from), to: dateTime(to) } };
}

function setup() {
  const store = configureStore();
  store.getState().explore.panes = {
    left: makeExplorePaneState({
      range: makeRange(1000, 2000),
      logsResult: { hasUniqueLabels: false, rows: [], series: [] },
    }),
  };

  render(
    <TestProvider store={store}>
      <LogsContainer
        exploreId="left"
        width={800}
        syncedTimes={false}
        loadingState={LoadingState.Done}
        onClickFilterLabel={jest.fn()}
        onClickFilterOutLabel={jest.fn()}
        onStartScanning={jest.fn()}
        onStopScanning={jest.fn()}
        eventBus={new EventBusSrv()}
        splitOpenFn={jest.fn()}
        isFilterLabelActive={jest.fn()}
        onClickFilterString={jest.fn()}
        onClickFilterOutString={jest.fn()}
      />
    </TestProvider>
  );

  return { store };
}

describe('LogsContainer', () => {
  beforeEach(() => {
    mockLogsProps.length = 0;
    // setSupplementaryQueryEnabled persists the flag, which would leak into the next test's initial state
    window.localStorage.clear();
  });

  it('keeps getFieldLinks identity when only the logs volume state changes', () => {
    const { store } = setup();
    const renderCount = mockLogsProps.length;
    const initialGetFieldLinks = getLastLogsProps().getFieldLinks;

    act(() => {
      store.dispatch(setSupplementaryQueryEnabled('left', false, SupplementaryQueryType.LogsVolume));
    });

    expect(mockLogsProps.length).toBeGreaterThan(renderCount);
    expect(getLastLogsProps().logsVolumeEnabled).toBe(false);
    expect(getLastLogsProps().getFieldLinks).toBe(initialGetFieldLinks);
  });

  it('provides a new getFieldLinks when the time range changes', () => {
    const { store } = setup();
    const initialGetFieldLinks = getLastLogsProps().getFieldLinks;
    const newRange = makeRange(3000, 4000);

    act(() => {
      store.dispatch(
        changeRangeAction({ exploreId: 'left', range: newRange, absoluteRange: { from: 3000, to: 4000 } })
      );
    });

    expect(getLastLogsProps().range).toBe(newRange);
    expect(getLastLogsProps().getFieldLinks).not.toBe(initialGetFieldLinks);
  });
});
