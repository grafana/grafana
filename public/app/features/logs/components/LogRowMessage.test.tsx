import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ComponentProps } from 'react';

import { CoreApp, createTheme, LogLevel, LogRowModel } from '@grafana/data';

import { LogRowMessage } from './LogRowMessage';
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

  describe('with show context', () => {
    it('should show context button', () => {
      setup({ showContextToggle: () => true });
      expect(screen.queryByLabelText('Show context')).toBeInTheDocument();
    });

    it('should not show context button', () => {
      setup({ showContextToggle: () => false });
      expect(screen.queryByLabelText('Show context')).not.toBeInTheDocument();
    });

    it('should call `onOpenContext` with row on click', async () => {
      const showContextToggle = jest.fn();
      const props = setup({ showContextToggle: () => true, onOpenContext: showContextToggle });
      const button = screen.getByLabelText('Show context');

      await userEvent.click(button);

      expect(showContextToggle).toHaveBeenCalledWith(props.row);
    });
  });

  describe('with permalinking', () => {
    it('should show permalinking button when `onPermalinkClick` is defined', () => {
      setup({ onPermalinkClick: jest.fn() });
      expect(screen.queryByLabelText('Copy shortlink')).toBeInTheDocument();
    });

    it('should not show permalinking button when `onPermalinkClick` is not defined', () => {
      setup();
      expect(screen.queryByLabelText('Copy shortlink')).not.toBeInTheDocument();
    });

    it('should call `onPermalinkClick` with row on click', async () => {
      const permalinkClick = jest.fn();
      const props = setup({ onPermalinkClick: permalinkClick });
      const button = screen.getByLabelText('Copy shortlink');

      await userEvent.click(button);

      expect(permalinkClick).toHaveBeenCalledWith(props.row);
    });
  });

  describe('with pinning', () => {
    describe('for `onPinLine`', () => {
      it('should show pinning button when `onPinLine` is defined', () => {
        setup({ onPinLine: jest.fn() });
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

      it('should show 2 pinning buttons when `onUnpinLine` and `pinned` is defined', () => {
        // we show 2 because we now have an "always visible" menu, and a "hover" menu
        setup({ onUnpinLine: jest.fn(), pinned: true });
        expect(screen.queryAllByLabelText('Unpin line').length).toBe(2);
      });

      it('should not show pinning button when `onUnpinLine` is not defined', () => {
        setup();
        expect(screen.queryByLabelText('Unpin line')).not.toBeInTheDocument();
      });

      it('should call `onUnpinLine` on click', async () => {
        const onUnpinLine = jest.fn();
        setup({ onUnpinLine, pinned: true });
        const button = screen.getAllByLabelText('Unpin line')[0];

        await userEvent.click(button);

        expect(onUnpinLine).toHaveBeenCalledTimes(1);
      });
    });
  });
});
