import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CoreApp, createTheme, LogLevel, LogRowModel } from '@grafana/data';

import { LogRowMessage, Props } from './LogRowMessage';
import { createLogRow } from './__mocks__/logRow';
import { getLogRowStyles } from './getLogRowStyles';

const setup = (propOverrides?: Partial<Props>, rowOverrides?: Partial<LogRowModel>) => {
  const theme = createTheme();
  const styles = getLogRowStyles(theme);
  const props: Props = {
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
    it('should show permalinking button', () => {
      setup({ onPermalinkClick: jest.fn() });
      expect(screen.queryByLabelText('Copy shortlink to logline')).toBeInTheDocument();
    });

    it('should not show permalinking button', () => {
      setup();
      expect(screen.queryByLabelText('Copy shortlink to logline')).not.toBeInTheDocument();
    });

    it('should call `onPermalinkClick` with row on click', async () => {
      const permalinkClick = jest.fn();
      const props = setup({ onPermalinkClick: permalinkClick });
      const button = screen.getByLabelText('Copy shortlink to logline');

      await userEvent.click(button);

      expect(permalinkClick).toHaveBeenCalledWith(props.row);
    });
  });
});
