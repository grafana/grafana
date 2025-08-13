import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoreApp, getDefaultTimeRange, LogRowModel, LogsDedupStrategy, LogsSortOrder, store } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';

import { disablePopoverMenu, enablePopoverMenu, isPopoverMenuDisabled } from '../../utils';
import { createLogRow } from '../mocks/logRow';

import { LogList, Props } from './LogList';

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: jest.fn(() => [true, jest.fn()]),
}));

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
    reportInteraction: jest.fn(),
    config: {
      ...jest.requireActual('@grafana/runtime').config,
      featureToggles: {
        ...jest.requireActual('@grafana/runtime').config.featureToggles,
        logRowsPopoverMenu: true,
      },
    },
  };
});

jest.mock('../../utils', () => ({
  ...jest.requireActual('../../utils'),
  isPopoverMenuDisabled: jest.fn(),
  disablePopoverMenu: jest.fn(),
  enablePopoverMenu: jest.fn(),
}));

const originalFlagValue = config.featureToggles.newLogsPanel;
beforeAll(() => {
  config.featureToggles.newLogsPanel = true;
});
afterAll(() => {
  config.featureToggles.newLogsPanel = originalFlagValue;
});

describe('LogList', () => {
  let logs: LogRowModel[], defaultProps: Props;
  beforeEach(() => {
    logs = [
      createLogRow({ uid: '1', labels: { name_of_the_label: 'value of the label' } }),
      createLogRow({ uid: '2' }),
    ];
    defaultProps = {
      app: CoreApp.Explore,
      containerElement: document.createElement('div'),
      dedupStrategy: LogsDedupStrategy.none,
      displayedFields: [],
      enableLogDetails: true,
      logs,
      showControls: false,
      showTime: false,
      sortOrder: LogsSortOrder.Descending,
      timeRange: getDefaultTimeRange(),
      timeZone: 'browser',
      wrapLogMessage: false,
    };
  });

  test('Renders a list of logs without controls ', async () => {
    render(<LogList {...defaultProps} />);
    expect(screen.getByText('log message 1')).toBeInTheDocument();
    expect(screen.getByText('log message 2')).toBeInTheDocument();
    expect(screen.queryByLabelText('Scroll to bottom')).not.toBeInTheDocument();
  });

  test('Renders a list of logs with controls', async () => {
    render(<LogList {...defaultProps} showControls={true} />);
    expect(screen.getByText('log message 1')).toBeInTheDocument();
    expect(screen.getByText('log message 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Scroll to bottom')).toBeInTheDocument();
  });

  test('Reports mouse over events', async () => {
    const onLogRowHover = jest.fn();
    render(<LogList {...defaultProps} onLogLineHover={onLogRowHover} />);
    await userEvent.hover(screen.getByText('log message 1'));
    expect(onLogRowHover).toHaveBeenCalledTimes(1);
    expect(onLogRowHover).toHaveBeenCalledWith(expect.objectContaining(logs[0]));
  });

  test('Supports showing log details', async () => {
    jest.spyOn(store, 'get').mockImplementation((option: string) => {
      if (option === 'storage-key.detailsMode') {
        return 'sidebar';
      }
      return undefined;
    });
    const onClickFilterLabel = jest.fn();
    const onClickFilterOutLabel = jest.fn();
    const onClickShowField = jest.fn();

    render(
      <LogList
        {...defaultProps}
        enableLogDetails={true}
        onClickFilterLabel={onClickFilterLabel}
        onClickFilterOutLabel={onClickFilterOutLabel}
        onClickShowField={onClickShowField}
        logOptionsStorageKey="storage-key"
      />
    );

    await userEvent.click(screen.getByText('log message 1'));
    await screen.findByText('Fields');

    expect(screen.getByText('name_of_the_label')).toBeInTheDocument();
    expect(screen.getByText('value of the label')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Filter for value in query A'));
    expect(onClickFilterLabel).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByLabelText('Filter out value in query A'));
    expect(onClickFilterOutLabel).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByLabelText('Show this field instead of the message'));
    expect(onClickShowField).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByLabelText('Close log details'));

    expect(screen.queryByText('Fields')).not.toBeInTheDocument();
    expect(screen.queryByText('Close log details')).not.toBeInTheDocument();
  });

  test('Supports showing inline log details', async () => {
    jest.spyOn(store, 'get').mockImplementation((option: string) => {
      if (option === 'storage-key.detailsMode') {
        return 'inline';
      }
      return undefined;
    });
    const onClickFilterLabel = jest.fn();
    const onClickFilterOutLabel = jest.fn();
    const onClickShowField = jest.fn();

    render(
      <LogList
        {...defaultProps}
        enableLogDetails={true}
        onClickFilterLabel={onClickFilterLabel}
        onClickFilterOutLabel={onClickFilterOutLabel}
        onClickShowField={onClickShowField}
        logOptionsStorageKey="storage-key"
      />
    );

    await userEvent.click(screen.getByText('log message 1'));
    await screen.findByText('Fields');

    expect(screen.getByText('name_of_the_label')).toBeInTheDocument();
    expect(screen.getByText('value of the label')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Filter for value in query A'));
    expect(onClickFilterLabel).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByLabelText('Filter out value in query A'));
    expect(onClickFilterOutLabel).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByLabelText('Show this field instead of the message'));
    expect(onClickShowField).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByLabelText('Close log details'));

    expect(screen.queryByText('Fields')).not.toBeInTheDocument();
    expect(screen.queryByText('Close log details')).not.toBeInTheDocument();
  });

  test('Allows people to select text without opening log details', async () => {
    const spy = jest.spyOn(document, 'getSelection');
    spy.mockReturnValue({
      toString: () => 'selected log line',
      removeAllRanges: () => {},
      addRange: (range: Range) => {},
    } as Selection);

    render(<LogList {...defaultProps} enableLogDetails={true} />);

    await userEvent.click(screen.getByText('log message 1'));

    expect(screen.queryByText('name_of_the_label')).not.toBeInTheDocument();
    expect(screen.queryByText('value of the label')).not.toBeInTheDocument();
    expect(screen.queryByText('Fields')).not.toBeInTheDocument();
    expect(screen.queryByText('Close log details')).not.toBeInTheDocument();

    spy.mockRestore();
  });

  describe('Popover menu', () => {
    function setup(overrides: Partial<Props> = {}) {
      return render(
        <LogList {...defaultProps} onClickFilterString={jest.fn()} onClickFilterOutString={jest.fn()} {...overrides} />
      );
    }
    let orgGetSelection: () => Selection | null;
    beforeEach(() => {
      jest.mocked(isPopoverMenuDisabled).mockReturnValue(false);
    });
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
    it('Appears after selecting text', async () => {
      setup();
      await userEvent.click(screen.getByText('log message 1'));
      expect(screen.getByText('Copy selection')).toBeInTheDocument();
      expect(screen.getByText('Add as line contains filter')).toBeInTheDocument();
      expect(screen.getByText('Add as line does not contain filter')).toBeInTheDocument();
    });
    it('Can be disabled', async () => {
      setup();
      await userEvent.click(screen.getByText('log message 1'));
      await userEvent.click(screen.getByText('Disable menu'));
      await userEvent.click(screen.getByText('Confirm'));
      expect(disablePopoverMenu).toHaveBeenCalledTimes(1);
    });
    it('Does not appear when disabled', async () => {
      jest.mocked(isPopoverMenuDisabled).mockReturnValue(true);
      setup();
      await userEvent.click(screen.getByText('log message 1'));
      expect(screen.queryByText('Copy selection')).not.toBeInTheDocument();
    });
    it('Can be re-enabled', async () => {
      jest.mocked(isPopoverMenuDisabled).mockReturnValue(true);
      const user = userEvent.setup();
      setup();
      await user.keyboard('[AltLeft>]'); // Press Alt (without releasing it)
      await user.click(screen.getByText('log message 1'));
      expect(enablePopoverMenu).toHaveBeenCalledTimes(1);
    });
    it('Does not appear when the props are not defined', async () => {
      setup({
        onClickFilterOutString: undefined,
        onClickFilterString: undefined,
      });
      await userEvent.click(screen.getByText('log message 1'));
      expect(screen.queryByText('Copy selection')).not.toBeInTheDocument();
    });
    it('Appears after selecting text', async () => {
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
        expect(screen.getByText(/Fields/)).toBeInTheDocument();
      });
    });
  });
  describe('Text search', () => {
    test('Supports text search', async () => {
      render(<LogList {...defaultProps} />);

      expect(screen.queryByPlaceholderText('Search in logs')).not.toBeInTheDocument();
      expect(screen.getByText('log message 1')).toBeInTheDocument();
      expect(screen.getByText('log message 2')).toBeInTheDocument();

      await userEvent.keyboard('{Control>}{f}{/Control}');

      expect(screen.getByPlaceholderText('Search in logs')).toBeInTheDocument();

      await userEvent.type(screen.getByPlaceholderText('Search in logs'), 'message 2');

      expect(screen.getByText('log message 1')).toBeInTheDocument();
      expect(screen.queryByText('log message 2')).not.toBeInTheDocument();
      expect(screen.getByText('message 2')).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Filter matching logs'));

      expect(screen.queryByText('log message 1')).not.toBeInTheDocument();
      expect(screen.getByText('message 2')).toBeInTheDocument();

      await userEvent.keyboard('{Escape}');

      expect(screen.queryByPlaceholderText('Search in logs')).not.toBeInTheDocument();
    });

    test('Does not conflict with search words', async () => {
      logs = [
        createLogRow({ uid: '1' }),
        createLogRow({ uid: '2', entry: '(?i)some text', searchWords: ['some text'] }),
      ];

      render(<LogList {...defaultProps} logs={logs} />);

      expect(screen.queryByPlaceholderText('Search in logs')).not.toBeInTheDocument();
      expect(screen.getByText('log message 1')).toBeInTheDocument();
      expect(screen.getByText('some text')).toBeInTheDocument();

      await userEvent.keyboard('{Control>}{f}{/Control}');

      expect(screen.getByPlaceholderText('Search in logs')).toBeInTheDocument();

      await userEvent.type(screen.getByPlaceholderText('Search in logs'), '(?i)');

      expect(screen.getByText('log message 1')).toBeInTheDocument();
      expect(screen.getByText('(?i)')).toBeInTheDocument();
      expect(screen.getByText('some text')).toBeInTheDocument();

      await userEvent.clear(screen.getByPlaceholderText('Search in logs'));

      expect(screen.getByText('log message 1')).toBeInTheDocument();
      expect(screen.getByText('some text')).toBeInTheDocument();
    });

    test('Allows to toggle between ms and ns precision timestamps', async () => {
      logs = [createLogRow({ uid: '1', timeEpochMs: 1754472919504, timeEpochNs: '1754472919504133766' })];

      render(<LogList {...defaultProps} showTime showControls logs={logs} />);

      expect(screen.getByText('2025-08-06 03:35:19.504')).toBeInTheDocument();
      expect(screen.getByLabelText('Show nanosecond timestamps')).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Show nanosecond timestamps'));

      expect(screen.getByText('2025-08-06 03:35:19.504133766')).toBeInTheDocument();
      expect(screen.getByLabelText('Hide timestamps')).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Hide timestamps'));

      expect(screen.queryByText(/2025-08-06 03:35:19/)).not.toBeInTheDocument();
      expect(screen.getByLabelText('Show millisecond timestamps')).toBeInTheDocument();
    });
  });
  describe('Interactions', () => {
    beforeEach(() => {
      sessionStorage.clear();
      jest.mocked(reportInteraction).mockClear();
    });
    test('Reports interactions ', async () => {
      render(<LogList {...defaultProps} />);
      await screen.findByText('log message 1');
      expect(reportInteraction).toHaveBeenCalled();
    });
    test('Can disable interaction report ', async () => {
      render(<LogList {...defaultProps} noInteractions={true} />);
      await screen.findByText('log message 1');
      expect(reportInteraction).not.toHaveBeenCalled();
    });
  });
});
