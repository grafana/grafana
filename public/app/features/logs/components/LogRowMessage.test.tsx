import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';

import { CoreApp, createTheme, LogLevel, LogRowModel } from '@grafana/data';
import { IconButton } from '@grafana/ui';

import { LogRowMessage, MAX_CHARACTERS } from './LogRowMessage';
import { createLogRow } from './__mocks__/logRow';
import { getLogRowStyles } from './getLogRowStyles';

const setup = (propOverrides?: Partial<ComponentProps<typeof LogRowMessage>>, rowOverrides?: Partial<LogRowModel>) => {
  const theme = createTheme();
  const styles = getLogRowStyles(theme);
  const props: ComponentProps<typeof LogRowMessage> = {
    wrapLogMessage: false,
    row: createLogRow({ entry: 'test123', logLevel: LogLevel.error, timeEpochMs: 1546297200000, ...rowOverrides }),
    onOpenContext: () => {},
    prettifyLogMessage: false,
    app: CoreApp.Explore,
    styles,
    mouseIsOver: true,
    onBlur: jest.fn(),
    ...(propOverrides || {}),
  };

  render(
    <table>
      <tbody>
        <tr>
          <LogRowMessage {...props} />
        </tr>
      </tbody>
    </table>
  );

  return props;
};

describe('LogRowMessage', () => {
  it('renders row entry', () => {
    setup();
    expect(screen.queryByText('test123')).toBeInTheDocument();
  });

  it('should hide the menu if the mouse is not over', async () => {
    setup({ showContextToggle: () => true, mouseIsOver: false });
    expect(screen.queryByLabelText('Show context')).not.toBeInTheDocument();
  });

  describe('with show context', () => {
    it('should show context button', async () => {
      setup({ showContextToggle: () => true });
      await userEvent.hover(screen.getByText('test123'));
      expect(screen.queryByLabelText('Show context')).toBeInTheDocument();
    });

    it('should not show context button', () => {
      setup({ showContextToggle: () => false });
      expect(screen.queryByLabelText('Show context')).not.toBeInTheDocument();
    });

    it('should call `onOpenContext` with row on click', async () => {
      const showContextToggle = jest.fn();
      const props = setup({ showContextToggle: () => true, onOpenContext: showContextToggle });
      await userEvent.hover(screen.getByText('test123'));
      const button = screen.getByLabelText('Show context');

      await userEvent.click(button);

      expect(showContextToggle).toHaveBeenCalledWith(props.row);
    });
  });

  describe('with permalinking', () => {
    it('should show permalinking button when `onPermalinkClick` is defined and rowId is defined', async () => {
      setup({ onPermalinkClick: jest.fn() }, { rowId: 'id1' });
      await userEvent.hover(screen.getByText('test123'));
      expect(screen.queryByLabelText('Copy shortlink')).toBeInTheDocument();
    });

    it('should not show permalinking button when `onPermalinkClick` is defined and rowId is not defined', async () => {
      setup({ onPermalinkClick: jest.fn() });
      await userEvent.hover(screen.getByText('test123'));
      expect(screen.queryByLabelText('Copy shortlink')).not.toBeInTheDocument();
    });

    it('should not show permalinking button when `onPermalinkClick` is not defined', () => {
      setup();
      expect(screen.queryByLabelText('Copy shortlink')).not.toBeInTheDocument();
    });

    it('should call `onPermalinkClick` with row on click', async () => {
      const permalinkClick = jest.fn();
      const props = setup({ onPermalinkClick: permalinkClick }, { rowId: 'id1' });
      await userEvent.hover(screen.getByText('test123'));
      const button = screen.getByLabelText('Copy shortlink');

      await userEvent.click(button);

      expect(permalinkClick).toHaveBeenCalledWith(props.row);
    });
  });

  describe('with pinning', () => {
    describe('for `onPinLine`', () => {
      it('should show pinning button when `onPinLine` is defined', async () => {
        setup({ onPinLine: jest.fn() });
        await userEvent.hover(screen.getByText('test123'));
        expect(screen.queryByLabelText('Pin line')).toBeInTheDocument();
      });

      it('should not show pinning button when `onPinLine` and `pinned` is defined', () => {
        setup({ onPinLine: jest.fn(), pinned: true });
        expect(screen.queryByLabelText('Pin line')).not.toBeInTheDocument();
      });

      it('should not show pinning button when `onPinLine` is not defined', () => {
        setup();
        expect(screen.queryByLabelText('Pin line')).not.toBeInTheDocument();
      });

      it('should call `onPinLine` on click', async () => {
        const onPinLine = jest.fn();
        setup({ onPinLine });
        await userEvent.hover(screen.getByText('test123'));
        const button = screen.getByLabelText('Pin line');

        await userEvent.click(button);

        expect(onPinLine).toHaveBeenCalledTimes(1);
      });
    });

    describe('for `onUnpinLine`', () => {
      it('should not show pinning button when `onUnpinLine` is defined', () => {
        setup({ onUnpinLine: jest.fn() });
        expect(screen.queryByLabelText('Unpin line')).not.toBeInTheDocument();
      });

      it('should show 1 pinning buttons when `onUnpinLine` and `pinned` is defined', () => {
        // we show 1 because we now have an "always visible" menu, the others are rendered on mouse over
        setup({ onUnpinLine: jest.fn(), pinned: true });
        expect(screen.queryAllByLabelText('Unpin line').length).toBe(1);
      });

      it('should not show pinning button when `onUnpinLine` is not defined', () => {
        setup();
        expect(screen.queryByLabelText('Unpin line')).not.toBeInTheDocument();
      });

      it('should call `onUnpinLine` on click', async () => {
        const onUnpinLine = jest.fn();
        setup({ onUnpinLine, pinned: true });
        const button = screen.getByLabelText('Unpin line');

        // There's an issue with userEvent and this button, so we use fireEvent instead
        fireEvent.click(button);

        expect(onUnpinLine).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('For multi-line logs', () => {
    const entry = `Line1
line2
line3`;
    const singleLineEntry = entry.replace(/(\r\n|\n|\r)/g, '');
    it('Displays the original log line when wrapping is enabled', () => {
      setup({
        row: createLogRow({ entry, logLevel: LogLevel.error, timeEpochMs: 1546297200000 }),
        wrapLogMessage: true,
      });
      expect(screen.getByText(/Line1/)).toBeInTheDocument();
      expect(screen.getByText(/line2/)).toBeInTheDocument();
      expect(screen.getByText(/line3/)).toBeInTheDocument();
      expect(screen.queryByText(singleLineEntry)).not.toBeInTheDocument();
    });

    it('Removes new lines from the original log line when wrapping is disabled', () => {
      setup({
        row: createLogRow({ entry, logLevel: LogLevel.error, timeEpochMs: 1546297200000 }),
        wrapLogMessage: false,
      });
      expect(screen.getByText(singleLineEntry)).toBeInTheDocument();
    });

    it('Displays the original log line when the line is expanded', () => {
      setup({
        row: createLogRow({ entry, logLevel: LogLevel.error, timeEpochMs: 1546297200000 }),
        wrapLogMessage: true,
        expanded: true,
      });
      expect(screen.getByText(/Line1/)).toBeInTheDocument();
      expect(screen.getByText(/line2/)).toBeInTheDocument();
      expect(screen.getByText(/line3/)).toBeInTheDocument();
      expect(screen.queryByText(singleLineEntry)).not.toBeInTheDocument();
    });
  });

  describe('With custom buttons', () => {
    it('supports custom buttons before and after the default options', async () => {
      const onBefore = jest.fn();
      const logRowMenuIconsBefore = [
        <IconButton name="eye-slash" onClick={onBefore} tooltip="Addon before" aria-label="Addon before" key={1} />,
      ];
      const onAfter = jest.fn();
      const logRowMenuIconsAfter = [
        <IconButton name="rss" onClick={onAfter} tooltip="Addon after" aria-label="Addon after" key={1} />,
      ];

      const { row } = setup({ logRowMenuIconsBefore, logRowMenuIconsAfter });

      await userEvent.click(screen.getByLabelText('Addon before'));
      await userEvent.click(screen.getByLabelText('Addon after'));

      expect(onBefore).toHaveBeenCalledWith(expect.anything(), row);
      expect(onAfter).toHaveBeenCalledWith(expect.anything(), row);
    });
  });

  describe('Extremely long log lines', () => {
    let entry = '';
    beforeEach(() => {
      entry = new Array(MAX_CHARACTERS).fill('a').join('') + 'b';
    });
    it('Displays an ellipsis for log lines above the character limit', async () => {
      setup({
        row: createLogRow({ entry, logLevel: LogLevel.error, timeEpochMs: 1546297200000 }),
      });
      expect(screen.getByText(/1 more/)).toBeInTheDocument();
      await userEvent.click(screen.getByText(/1 more/));
      expect(screen.queryByText(/1 more/)).not.toBeInTheDocument();
    });
  });
});
