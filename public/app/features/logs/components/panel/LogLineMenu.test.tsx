import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataSourceApi, CoreApp, createTheme, LogsDedupStrategy, LogsSortOrder } from '@grafana/data';
import { type DataSourceSrv, getDataSourceSrv, getDataSourceInstance } from '@grafana/runtime';
import { Portal } from '@grafana/ui';

import * as logsUtils from '../../utils';
import { createLogLine } from '../mocks/logRow';

import { LogDetailsContextProvider } from './LogDetailsContext';
import { getStyles } from './LogLine';
import { LogLineMenu, type LogLineMenuCustomItem } from './LogLineMenu';
import { LogListContextProvider } from './LogListContext';
import { defaultProps, defaultValue } from './__mocks__/LogListContext';
import { type LogListModel } from './processing';

jest.mock('../../utils', () => makeSpyable('../../utils'));

jest.mock('./LogListContext');

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: jest.fn().mockReturnValue({
    isLoading: false,
    isAvailable: true,
    openAssistant: jest.fn(),
  }),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  isAssistantAvailable: true,
  getDataSourceSrv: jest.fn(),
  getDataSourceInstance: jest.fn(),
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
    jest.mocked(getDataSourceSrv).mockReturnValue({
      get: jest.fn().mockResolvedValue({}),
    } as unknown as DataSourceSrv);
    jest.mocked(getDataSourceInstance).mockResolvedValue({} as DataSourceApi);
  });

  test('Renders the component', async () => {
    render(<LogLineMenu log={log} styles={styles} />);
    expect(screen.queryByRole('menuitem', { name: /Copy log line message/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Log menu'));
    expect(screen.getByRole('menuitem', { name: /Copy log line message/i })).toBeInTheDocument();
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

    test('Copy log line as JSON copies structured JSON from the log', async () => {
      const copyTextSpy = jest.spyOn(logsUtils, 'copyText').mockResolvedValue(undefined);

      render(
        <LogListContextProvider {...contextProps}>
          <LogLineMenu log={log} styles={styles} />
        </LogListContextProvider>
      );
      await userEvent.click(screen.getByLabelText('Log menu'));
      const jsonMenuItem = screen.getAllByRole('menuitem').find((el) => /JSON/i.test(el.textContent ?? ''));
      expect(jsonMenuItem).toBeTruthy();
      await userEvent.click(jsonMenuItem!);

      await waitFor(() => {
        expect(copyTextSpy).toHaveBeenCalled();
        const text = copyTextSpy.mock.calls[0][0] as string;
        const parsed = JSON.parse(text);
        expect(parsed).toMatchObject({
          line: expect.any(String),
          labels: expect.objectContaining({ place: 'luna' }),
        });
      });
      copyTextSpy.mockRestore();
    });

    // A Document Picture-in-Picture window (the Grafana Assistant pop-out) is another window: only it has focus while
    // the user works there, so the copy has to go through its clipboard, after the menu has closed too.
    test('Copy log line as JSON copies in the window the menu was opened in', async () => {
      const copyTextSpy = jest.spyOn(logsUtils, 'copyText').mockResolvedValue(undefined);
      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      const otherDocument = iframe.contentDocument!;
      const ui = () => (
        <Portal root={otherDocument.body}>
          <LogListContextProvider {...contextProps}>
            <LogLineMenu log={log} styles={styles} />
          </LogListContextProvider>
        </Portal>
      );
      const view = render(ui());
      // A Portal hands its element to the portals inside it, such as the menu's, from its second render.
      view.rerender(ui());

      try {
        // user-event drives pointer input through this window's document, so fire the other window's events directly
        fireEvent.click(within(otherDocument.body).getByLabelText('Log menu'));
        fireEvent.click(within(otherDocument.body).getByText('Copy log line contents as JSON'));

        await waitFor(() => expect(copyTextSpy).toHaveBeenCalled());
        // the menu has closed by now, so the element is the one it was opened in
        expect(copyTextSpy.mock.calls[0][1].current?.ownerDocument).toBe(otherDocument);
      } finally {
        copyTextSpy.mockRestore();
        // Unmount before the iframe goes, or React cannot remove the menu from it.
        view.unmount();
        iframe.remove();
      }
    });

    test('Renders custom log line menu items', async () => {
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
        <LogListContextProvider {...contextProps}>
          <LogDetailsContextProvider enableLogDetails logs={contextProps.logs} showControls>
            <LogLineMenu log={log} styles={styles} />
          </LogDetailsContextProvider>
        </LogListContextProvider>
      );
      await userEvent.click(screen.getByLabelText('Log menu'));
      await screen.findByText('Show log details');
    });

    test('Does not show log details option when disabled', async () => {
      render(
        <LogListContextProvider {...contextProps}>
          <LogDetailsContextProvider logs={contextProps.logs} showControls enableLogDetails={false}>
            <LogLineMenu log={log} styles={styles} />
          </LogDetailsContextProvider>
        </LogListContextProvider>
      );
      await userEvent.click(screen.getByLabelText('Log menu'));
      expect(screen.queryByText('Show log details')).not.toBeInTheDocument();
    });
  });
});
