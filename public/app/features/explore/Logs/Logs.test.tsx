import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ComponentProps } from 'react';

import {
  EventBusSrv,
  ExploreLogsPanelState,
  LoadingState,
  LogLevel,
  LogRowModel,
  MutableDataFrame,
  toUtc,
} from '@grafana/data';
import { ExploreId } from 'app/types';

import { Logs } from './Logs';

const changePanelState = jest.fn();
jest.mock('../state/explorePane', () => ({
  ...jest.requireActual('../state/explorePane'),
  changePanelState: (exploreId: ExploreId, panel: 'logs', panelState: {} | ExploreLogsPanelState) => {
    return changePanelState(exploreId, panel, panelState);
  },
}));

describe('Logs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getComponent = (partialProps?: Partial<ComponentProps<typeof Logs>>, logs?: LogRowModel[]) => {
    const rows = [
      makeLog({ uid: '1', timeEpochMs: 1 }),
      makeLog({ uid: '2', timeEpochMs: 2 }),
      makeLog({ uid: '3', timeEpochMs: 3 }),
    ];

    return (
      <Logs
        exploreId={ExploreId.left}
        splitOpen={() => undefined}
        logsVolumeEnabled={true}
        onSetLogsVolumeEnabled={() => null}
        onClickFilterLabel={() => null}
        onClickFilterOutLabel={() => null}
        logsVolumeData={undefined}
        loadLogsVolumeData={() => undefined}
        logRows={logs ?? rows}
        timeZone={'utc'}
        width={50}
        loading={false}
        loadingState={LoadingState.Done}
        absoluteRange={{
          from: toUtc('2019-01-01 10:00:00').valueOf(),
          to: toUtc('2019-01-01 16:00:00').valueOf(),
        }}
        addResultsToCache={() => {}}
        onChangeTime={() => {}}
        clearCache={() => {}}
        getFieldLinks={() => {
          return [];
        }}
        eventBus={new EventBusSrv()}
        {...partialProps}
      />
    );
  };
  const setup = (partialProps?: Partial<ComponentProps<typeof Logs>>, logs?: LogRowModel[]) => {
    return render(getComponent(partialProps, logs));
  };

  it('should render logs', () => {
    setup();
    const logsSection = screen.getByTestId('logRows');
    let logRows = logsSection.querySelectorAll('tr');
    expect(logRows.length).toBe(3);
    expect(logRows[0].textContent).toContain('log message 3');
    expect(logRows[2].textContent).toContain('log message 1');
  });

  it('should render no logs found', () => {
    setup({}, []);

    expect(screen.getByText(/no logs found\./i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /scan for older logs/i,
      })
    ).toBeInTheDocument();
  });

  it('should render a load more button', () => {
    const scanningStarted = jest.fn();
    render(
      <Logs
        exploreId={ExploreId.left}
        splitOpen={() => undefined}
        logsVolumeEnabled={true}
        onSetLogsVolumeEnabled={() => null}
        onClickFilterLabel={() => null}
        onClickFilterOutLabel={() => null}
        logsVolumeData={undefined}
        loadLogsVolumeData={() => undefined}
        logRows={[]}
        onStartScanning={scanningStarted}
        timeZone={'utc'}
        width={50}
        loading={false}
        loadingState={LoadingState.Done}
        absoluteRange={{
          from: toUtc('2019-01-01 10:00:00').valueOf(),
          to: toUtc('2019-01-01 16:00:00').valueOf(),
        }}
        addResultsToCache={() => {}}
        onChangeTime={() => {}}
        clearCache={() => {}}
        getFieldLinks={() => {
          return [];
        }}
        eventBus={new EventBusSrv()}
      />
    );
    const button = screen.getByRole('button', {
      name: /scan for older logs/i,
    });
    button.click();
    expect(scanningStarted).toHaveBeenCalled();
  });

  it('should render a stop scanning button', () => {
    render(
      <Logs
        exploreId={ExploreId.left}
        splitOpen={() => undefined}
        logsVolumeEnabled={true}
        onSetLogsVolumeEnabled={() => null}
        onClickFilterLabel={() => null}
        onClickFilterOutLabel={() => null}
        logsVolumeData={undefined}
        loadLogsVolumeData={() => undefined}
        logRows={[]}
        scanning={true}
        timeZone={'utc'}
        width={50}
        loading={false}
        loadingState={LoadingState.Done}
        absoluteRange={{
          from: toUtc('2019-01-01 10:00:00').valueOf(),
          to: toUtc('2019-01-01 16:00:00').valueOf(),
        }}
        addResultsToCache={() => {}}
        onChangeTime={() => {}}
        clearCache={() => {}}
        getFieldLinks={() => {
          return [];
        }}
        eventBus={new EventBusSrv()}
      />
    );

    expect(
      screen.getByRole('button', {
        name: /stop scan/i,
      })
    ).toBeInTheDocument();
  });

  it('should render a stop scanning button', () => {
    const scanningStopped = jest.fn();

    render(
      <Logs
        exploreId={ExploreId.left}
        splitOpen={() => undefined}
        logsVolumeEnabled={true}
        onSetLogsVolumeEnabled={() => null}
        onClickFilterLabel={() => null}
        onClickFilterOutLabel={() => null}
        logsVolumeData={undefined}
        loadLogsVolumeData={() => undefined}
        logRows={[]}
        scanning={true}
        onStopScanning={scanningStopped}
        timeZone={'utc'}
        width={50}
        loading={false}
        loadingState={LoadingState.Done}
        absoluteRange={{
          from: toUtc('2019-01-01 10:00:00').valueOf(),
          to: toUtc('2019-01-01 16:00:00').valueOf(),
        }}
        addResultsToCache={() => {}}
        onChangeTime={() => {}}
        clearCache={() => {}}
        getFieldLinks={() => {
          return [];
        }}
        eventBus={new EventBusSrv()}
      />
    );

    const button = screen.getByRole('button', {
      name: /stop scan/i,
    });
    button.click();
    expect(scanningStopped).toHaveBeenCalled();
  });

  it('should flip the order', async () => {
    setup();
    const oldestFirstSelection = screen.getByLabelText('Oldest first');
    await userEvent.click(oldestFirstSelection);
    const logsSection = screen.getByTestId('logRows');
    let logRows = logsSection.querySelectorAll('tr');
    expect(logRows.length).toBe(3);
    expect(logRows[0].textContent).toContain('log message 1');
    expect(logRows[2].textContent).toContain('log message 3');
  });

  describe('for permalinking', () => {
    it('should dispatch a `changePanelState` event without the id', () => {
      const panelState = { logs: { id: '1' } };
      const { rerender } = setup({ loading: false, panelState });

      rerender(getComponent({ loading: true, exploreId: ExploreId.right, panelState }));
      rerender(getComponent({ loading: false, exploreId: ExploreId.right, panelState }));

      expect(changePanelState).toHaveBeenCalledWith(ExploreId.right, 'logs', { logs: {} });
    });

    it('should scroll the scrollElement into view if rows contain id', () => {
      const panelState = { logs: { id: '3' } };
      const scrollElementMock = { scroll: jest.fn() };
      setup({ loading: false, scrollElement: scrollElementMock as unknown as HTMLDivElement, panelState });

      expect(scrollElementMock.scroll).toHaveBeenCalled();
    });

    it('should not scroll the scrollElement into view if rows does not contain id', () => {
      const panelState = { logs: { id: 'not-included' } };
      const scrollElementMock = { scroll: jest.fn() };
      setup({ loading: false, scrollElement: scrollElementMock as unknown as HTMLDivElement, panelState });

      expect(scrollElementMock.scroll).not.toHaveBeenCalled();
    });
  });
});

const makeLog = (overrides: Partial<LogRowModel>): LogRowModel => {
  const uid = overrides.uid || '1';
  const entry = `log message ${uid}`;
  return {
    uid,
    entryFieldIndex: 0,
    rowIndex: 0,
    dataFrame: new MutableDataFrame(),
    logLevel: LogLevel.debug,
    entry,
    hasAnsi: false,
    hasUnescapedContent: false,
    labels: {},
    raw: entry,
    timeFromNow: '',
    timeEpochMs: 1,
    timeEpochNs: '1000000',
    timeLocal: '',
    timeUtc: '',
    ...overrides,
  };
};
