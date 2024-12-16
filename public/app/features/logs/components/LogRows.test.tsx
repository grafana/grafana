import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { range } from 'lodash';

import { LogRowModel, LogsDedupStrategy, LogsSortOrder } from '@grafana/data';

import { LogRows, PREVIEW_LIMIT, Props } from './LogRows';
import { createLogRow } from './__mocks__/logRow';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    featureToggles: {
      logRowsPopoverMenu: true,
    },
  },
}));

describe('LogRows', () => {
  it('renders rows', () => {
    const rows: LogRowModel[] = [createLogRow({ uid: '1' }), createLogRow({ uid: '2' }), createLogRow({ uid: '3' })];
    render(
      <LogRows
        logRows={rows}
        dedupStrategy={LogsDedupStrategy.none}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        prettifyLogMessage={true}
        timeZone={'utc'}
        enableLogDetails={true}
        displayedFields={[]}
        onClickFilterLabel={() => {}}
        onClickFilterOutLabel={() => {}}
        onClickHideField={() => {}}
        onClickShowField={() => {}}
      />
    );

    expect(screen.queryAllByRole('row')).toHaveLength(3);
    expect(screen.queryAllByRole('row').at(0)).toHaveTextContent('log message 1');
    expect(screen.queryAllByRole('row').at(1)).toHaveTextContent('log message 2');
    expect(screen.queryAllByRole('row').at(2)).toHaveTextContent('log message 3');
  });

  it('renders rows only limited number of rows first', () => {
    const rows: LogRowModel[] = [createLogRow({ uid: '1' }), createLogRow({ uid: '2' }), createLogRow({ uid: '3' })];
    jest.useFakeTimers();
    const { rerender } = render(
      <LogRows
        logRows={rows}
        dedupStrategy={LogsDedupStrategy.none}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        prettifyLogMessage={true}
        timeZone={'utc'}
        previewLimit={1}
        enableLogDetails={true}
      />
    );

    // There is an extra row with the rows that are rendering
    expect(screen.queryAllByRole('row')).toHaveLength(2);
    expect(screen.queryAllByRole('row').at(0)).toHaveTextContent('log message 1');

    act(() => {
      jest.runAllTimers();
    });
    rerender(
      <LogRows
        logRows={rows}
        dedupStrategy={LogsDedupStrategy.none}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        prettifyLogMessage={true}
        timeZone={'utc'}
        previewLimit={1}
        enableLogDetails={true}
        displayedFields={[]}
        onClickFilterLabel={() => {}}
        onClickFilterOutLabel={() => {}}
        onClickHideField={() => {}}
        onClickShowField={() => {}}
      />
    );

    expect(screen.queryAllByRole('row')).toHaveLength(3);
    expect(screen.queryAllByRole('row').at(0)).toHaveTextContent('log message 1');
    expect(screen.queryAllByRole('row').at(1)).toHaveTextContent('log message 2');
    expect(screen.queryAllByRole('row').at(2)).toHaveTextContent('log message 3');

    jest.useRealTimers();
  });

  it('renders deduped rows if supplied', () => {
    const rows: LogRowModel[] = [createLogRow({ uid: '1' }), createLogRow({ uid: '2' }), createLogRow({ uid: '3' })];
    const dedupedRows: LogRowModel[] = [createLogRow({ uid: '4' }), createLogRow({ uid: '5' })];
    render(
      <LogRows
        logRows={rows}
        deduplicatedRows={dedupedRows}
        dedupStrategy={LogsDedupStrategy.none}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        prettifyLogMessage={true}
        timeZone={'utc'}
        enableLogDetails={true}
        displayedFields={[]}
        onClickFilterLabel={() => {}}
        onClickFilterOutLabel={() => {}}
        onClickHideField={() => {}}
        onClickShowField={() => {}}
      />
    );
    expect(screen.queryAllByRole('row')).toHaveLength(2);
    expect(screen.queryAllByRole('row').at(0)).toHaveTextContent('log message 4');
    expect(screen.queryAllByRole('row').at(1)).toHaveTextContent('log message 5');
  });

  it('renders with default preview limit', () => {
    // PREVIEW_LIMIT * 2 is there because otherwise we just render all rows
    const rows: LogRowModel[] = range(PREVIEW_LIMIT * 2 + 1).map((num) => createLogRow({ uid: num.toString() }));
    render(
      <LogRows
        logRows={rows}
        dedupStrategy={LogsDedupStrategy.none}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        prettifyLogMessage={true}
        timeZone={'utc'}
        enableLogDetails={true}
        displayedFields={[]}
        onClickFilterLabel={() => {}}
        onClickFilterOutLabel={() => {}}
        onClickHideField={() => {}}
        onClickShowField={() => {}}
      />
    );

    // There is an extra row with the rows that are rendering
    expect(screen.queryAllByRole('row')).toHaveLength(101);
  });

  it('renders asc ordered rows if order and function supplied', () => {
    const rows: LogRowModel[] = [
      createLogRow({ uid: '1', timeEpochMs: 1 }),
      createLogRow({ uid: '3', timeEpochMs: 3 }),
      createLogRow({ uid: '2', timeEpochMs: 2 }),
    ];
    render(
      <LogRows
        logRows={rows}
        dedupStrategy={LogsDedupStrategy.none}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        prettifyLogMessage={true}
        timeZone={'utc'}
        logsSortOrder={LogsSortOrder.Ascending}
        enableLogDetails={true}
        displayedFields={[]}
        onClickFilterLabel={() => {}}
        onClickFilterOutLabel={() => {}}
        onClickHideField={() => {}}
        onClickShowField={() => {}}
      />
    );

    expect(screen.queryAllByRole('row').at(0)).toHaveTextContent('log message 1');
    expect(screen.queryAllByRole('row').at(1)).toHaveTextContent('log message 2');
    expect(screen.queryAllByRole('row').at(2)).toHaveTextContent('log message 3');
  });
  it('renders desc ordered rows if order and function supplied', () => {
    const rows: LogRowModel[] = [
      createLogRow({ uid: '1', timeEpochMs: 1 }),
      createLogRow({ uid: '3', timeEpochMs: 3 }),
      createLogRow({ uid: '2', timeEpochMs: 2 }),
    ];
    render(
      <LogRows
        logRows={rows}
        dedupStrategy={LogsDedupStrategy.none}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        prettifyLogMessage={true}
        timeZone={'utc'}
        logsSortOrder={LogsSortOrder.Descending}
        enableLogDetails={true}
        displayedFields={[]}
        onClickFilterLabel={() => {}}
        onClickFilterOutLabel={() => {}}
        onClickHideField={() => {}}
        onClickShowField={() => {}}
      />
    );

    expect(screen.queryAllByRole('row').at(0)).toHaveTextContent('log message 3');
    expect(screen.queryAllByRole('row').at(1)).toHaveTextContent('log message 2');
    expect(screen.queryAllByRole('row').at(2)).toHaveTextContent('log message 1');
  });
});

describe('Popover menu', () => {
  function setup(overrides: Partial<Props> = {}) {
    const rows: LogRowModel[] = [createLogRow({ uid: '1' })];
    return render(
      <LogRows
        logRows={rows}
        dedupStrategy={LogsDedupStrategy.none}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        prettifyLogMessage={true}
        timeZone={'utc'}
        logsSortOrder={LogsSortOrder.Descending}
        enableLogDetails={true}
        displayedFields={[]}
        onClickFilterOutString={() => {}}
        onClickFilterString={() => {}}
        {...overrides}
      />
    );
  }
  let orgGetSelection: () => Selection | null;
  beforeAll(() => {
    orgGetSelection = document.getSelection;
    jest.spyOn(document, 'getSelection').mockReturnValue({
      toString: () => 'selected log line',
      removeAllRanges: () => {},
      addRange: (range: Range) => {},
    } as Selection);
  });
  afterAll(() => {
    document.getSelection = orgGetSelection;
  });
  it('Does not appear in the document', () => {
    setup();
    expect(screen.queryByText('Copy selection')).not.toBeInTheDocument();
  });
  it('Appears after selecting test', async () => {
    setup();
    await userEvent.click(screen.getByText('log message 1'));
    expect(screen.getByText('Copy selection')).toBeInTheDocument();
    expect(screen.getByText('Add as line contains filter')).toBeInTheDocument();
    expect(screen.getByText('Add as line does not contain filter')).toBeInTheDocument();
  });
  it('Does not appear when the props are not defined', async () => {
    setup({
      onClickFilterOutString: undefined,
      onClickFilterString: undefined,
    });
    await userEvent.click(screen.getByText('log message 1'));
    expect(screen.queryByText('Copy selection')).not.toBeInTheDocument();
  });
  it('Appears after selecting test', async () => {
    const onClickFilterOutString = jest.fn();
    const onClickFilterString = jest.fn();
    setup({
      onClickFilterOutString,
      onClickFilterString,
    });
    await userEvent.click(screen.getByText('log message 1'));
    expect(screen.getByText('Copy selection')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Add as line contains filter'));

    await userEvent.click(screen.getByText('log message 1'));
    expect(screen.getByText('Copy selection')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Add as line does not contain filter'));

    expect(onClickFilterOutString).toHaveBeenCalledTimes(1);
    expect(onClickFilterString).toHaveBeenCalledTimes(1);
  });
  describe('Interacting with log details', () => {
    it('Allows text selection even if the popover menu is not available', async () => {
      setup({
        onClickFilterOutString: undefined,
        onClickFilterString: undefined,
      });
      await userEvent.click(screen.getByText('log message 1'));
      expect(screen.queryByText('Copy selection')).not.toBeInTheDocument();
      expect(screen.queryByText(/details/)).not.toBeInTheDocument();
    });

    it('Displays Log Details if there is no text selection', async () => {
      jest.spyOn(document, 'getSelection').mockReturnValue(null);
      setup({
        onClickFilterOutString: undefined,
        onClickFilterString: undefined,
      });
      await userEvent.click(screen.getByText('log message 1'));
      expect(screen.queryByText('Copy selection')).not.toBeInTheDocument();
      expect(screen.getByText(/details/)).toBeInTheDocument();
    });
  });
});
