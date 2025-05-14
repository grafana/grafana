import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme } from '@grafana/data';

import { createLogLine } from '../__mocks__/logRow';

import { getStyles } from './LogLine';
import { LogLineMenu } from './LogLineMenu';
import { LogListContext } from './LogListContext';
import { LogListModel } from './processing';

const theme = createTheme();
const styles = getStyles(theme);

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
        <LogListContext.Provider value={{ onPermalinkClick }}>
          <LogLineMenu log={log} styles={styles} />
        </LogListContext.Provider>
      );
      await userEvent.click(screen.getByLabelText('Log menu'));
      await userEvent.click(screen.getByText('Copy link to log line'));
      expect(onPermalinkClick).toHaveBeenCalledTimes(1);
    });

    test('Allows to open show context', async () => {
      const onOpenContext = jest.fn();
      const logSupportsContext = jest.fn().mockReturnValue(true);
      const getRowContextQuery = jest.fn();
      render(
        <LogListContext.Provider value={{ getRowContextQuery, logSupportsContext, onOpenContext }}>
          <LogLineMenu log={log} styles={styles} />
        </LogListContext.Provider>
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
        <LogListContext.Provider value={{ getRowContextQuery, logSupportsContext, onOpenContext }}>
          <LogLineMenu log={log} styles={styles} />
        </LogListContext.Provider>
      );
      await userEvent.click(screen.getByLabelText('Log menu'));
      expect(screen.queryByText('Show context')).not.toBeInTheDocument();
    });

    test('Allows to pin log line', async () => {
      const onPinLine = jest.fn();
      render(
        <LogListContext.Provider value={{ pinnedLogs: [], onPinLine }}>
          <LogLineMenu log={log} styles={styles} />
        </LogListContext.Provider>
      );
      await userEvent.click(screen.getByLabelText('Log menu'));
      await userEvent.click(screen.getByText('Pin log'));
      expect(onPinLine).toHaveBeenCalledTimes(1);
    });

    test('Allows to unpin log line', async () => {
      const onUnpinLine = jest.fn();
      render(
        <LogListContext.Provider value={{ pinnedLogs: [log.uid], onUnpinLine }}>
          <LogLineMenu log={log} styles={styles} />
        </LogListContext.Provider>
      );
      await userEvent.click(screen.getByLabelText('Log menu'));
      expect(screen.queryByText('Pin log')).not.toBeInTheDocument();
      await userEvent.click(screen.getByText('Unpin log'));
      expect(onUnpinLine).toHaveBeenCalledTimes(1);
    });
  });
});
