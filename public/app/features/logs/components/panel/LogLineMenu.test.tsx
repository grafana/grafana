import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoreApp, createTheme, LogsDedupStrategy, LogsSortOrder } from '@grafana/data';

import { createLogLine } from '../mocks/logRow';

import { getStyles } from './LogLine';
import { LogLineMenu, LogLineMenuCustomItem } from './LogLineMenu';
import { LogListContextProvider } from './LogListContext';
import { defaultProps, defaultValue } from './__mocks__/LogListContext';
import { LogListModel } from './processing';

jest.mock('./LogListContext');

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: jest.fn(() => [true, jest.fn()]),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  isAssistantAvailable: true,
}));

const theme = createTheme();
const styles = getStyles(theme);
const contextProps = {
  ...defaultProps,
  ...defaultValue,
  app: CoreApp.Unknown,
  dedupStrategy: LogsDedupStrategy.exact,
  displayedFields: [],
  logs: [],
  showControls: false,
  showTime: false,
  sortOrder: LogsSortOrder.Ascending,
  wrapLogMessage: false,
};

describe('LogLineMenu', () => {
  let log: LogListModel;
  beforeEach(() => {
    log = createLogLine({ labels: { place: 'luna' }, rowId: '1' });
  });

  test('Renders the component', async () => {
    render(<LogLineMenu log={log} styles={styles} />);
    expect(screen.queryByText('Copy log line')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Log menu'));
    expect(screen.getByText('Copy log line')).toBeInTheDocument();
  });

  describe('Options', () => {
    test('Allows to copy a permalink', async () => {
      const onPermalinkClick = jest.fn();
      render(
        <LogListContextProvider {...contextProps} onPermalinkClick={onPermalinkClick}>
          <LogLineMenu log={log} styles={styles} />
        </LogListContextProvider>
      );
      await userEvent.click(screen.getByLabelText('Log menu'));
      await userEvent.click(screen.getByText('Copy link to log line'));
      expect(onPermalinkClick).toHaveBeenCalledTimes(1);
    });

    test('Allows to copy a permalink', async () => {
      const customOption1onClick = jest.fn();
      const logLineMenuCustomItems: LogLineMenuCustomItem[] = [
        {
          label: 'Custom option 1',
          onClick: customOption1onClick,
        },
        {
          divider: true,
        },
        {
          label: 'Custom option 2',
          onClick: jest.fn(),
        },
      ];
      render(
        <LogListContextProvider {...contextProps} logLineMenuCustomItems={logLineMenuCustomItems}>
          <LogLineMenu log={log} styles={styles} />
        </LogListContextProvider>
      );
      await userEvent.click(screen.getByLabelText('Log menu'));
      await screen.findByText('Custom option 1');
      await screen.findByText('Custom option 2');
      await userEvent.click(screen.getByText('Custom option 1'));
      expect(customOption1onClick).toHaveBeenCalledTimes(1);
    });

    test('Allows to open show context', async () => {
      const onOpenContext = jest.fn();
      const logSupportsContext = jest.fn().mockReturnValue(true);
      const getRowContextQuery = jest.fn();
      render(
        <LogListContextProvider
          {...contextProps}
          getRowContextQuery={getRowContextQuery}
          logSupportsContext={logSupportsContext}
          onOpenContext={onOpenContext}
        >
          <LogLineMenu log={log} styles={styles} />
        </LogListContextProvider>
      );
      await userEvent.click(screen.getByLabelText('Log menu'));
      await userEvent.click(screen.getByText('Show context'));
      expect(onOpenContext).toHaveBeenCalledTimes(1);
    });

    test('Uses logSupportsContext to control the display of show context', async () => {
      const onOpenContext = jest.fn();
      const logSupportsContext = jest.fn().mockReturnValue(false);
      const getRowContextQuery = jest.fn();
      render(
        <LogListContextProvider
          {...contextProps}
          getRowContextQuery={getRowContextQuery}
          logSupportsContext={logSupportsContext}
          onOpenContext={onOpenContext}
        >
          <LogLineMenu log={log} styles={styles} />
        </LogListContextProvider>
      );
      await userEvent.click(screen.getByLabelText('Log menu'));
      expect(screen.queryByText('Show context')).not.toBeInTheDocument();
    });

    test('Allows to pin log line', async () => {
      const onPinLine = jest.fn();
      render(
        <LogListContextProvider {...contextProps} pinnedLogs={[]} onPinLine={onPinLine}>
          <LogLineMenu log={log} styles={styles} />
        </LogListContextProvider>
      );
      await userEvent.click(screen.getByLabelText('Log menu'));
      await userEvent.click(screen.getByText('Pin log'));
      expect(onPinLine).toHaveBeenCalledTimes(1);
    });

    test('Allows to unpin log line', async () => {
      const onUnpinLine = jest.fn();
      render(
        <LogListContextProvider {...contextProps} pinnedLogs={[log.uid]} onUnpinLine={onUnpinLine}>
          <LogLineMenu log={log} styles={styles} />
        </LogListContextProvider>
      );
      await userEvent.click(screen.getByLabelText('Log menu'));
      expect(screen.queryByText('Pin log')).not.toBeInTheDocument();
      await userEvent.click(screen.getByText('Unpin log'));
      expect(onUnpinLine).toHaveBeenCalledTimes(1);
    });

    test('Allows to open log details', async () => {
      render(
        <LogListContextProvider {...contextProps} enableLogDetails={true}>
          <LogLineMenu log={log} styles={styles} />
        </LogListContextProvider>
      );
      await userEvent.click(screen.getByLabelText('Log menu'));
      await screen.findByText('Show log details');
    });

    test('Does not show log details option when disabled', async () => {
      render(
        <LogListContextProvider {...contextProps} enableLogDetails={false}>
          <LogLineMenu log={log} styles={styles} />
        </LogListContextProvider>
      );
      await userEvent.click(screen.getByLabelText('Log menu'));
      expect(screen.queryByText('Show log details')).not.toBeInTheDocument();
    });
  });
});
