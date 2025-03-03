import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme, LogLevel } from '@grafana/data';
import { IconButton } from '@grafana/ui';

import { LOG_LINE_BODY_FIELD_NAME } from './LogDetailsBody';
import { LogRowMessageDisplayedFields, Props } from './LogRowMessageDisplayedFields';
import { createLogRow } from './__mocks__/logRow';
import { getLogRowStyles } from './getLogRowStyles';

const setup = (propOverrides: Partial<Props> = {}, detectedFields = ['place', 'planet']) => {
  const theme = createTheme();
  const styles = getLogRowStyles(theme);
  const labels = {
    place: 'Earth',
    planet: 'Mars',
  };
  const props: Props = {
    wrapLogMessage: false,
    row: createLogRow({ entry: 'Logs are wonderful', logLevel: LogLevel.error, timeEpochMs: 1546297200000, labels }),
    onOpenContext: () => {},
    styles,
    detectedFields,
    mouseIsOver: true,
    onBlur: jest.fn(),
    ...propOverrides,
  };

  render(
    <table>
      <tbody>
        <tr>
          <LogRowMessageDisplayedFields {...props} />
        </tr>
      </tbody>
    </table>
  );

  return props;
};

describe('LogRowMessageDisplayedFields', () => {
  it('renders diplayed fields from a log row', () => {
    setup();
    expect(screen.queryByText(/Logs are wonderful/)).not.toBeInTheDocument();
    expect(screen.getByText(/place=Earth/)).toBeInTheDocument();
    expect(screen.getByText(/planet=Mars/)).toBeInTheDocument();
  });

  it('renders diplayed fields and body from a log row', () => {
    setup({}, ['place', 'planet', LOG_LINE_BODY_FIELD_NAME]);
    expect(screen.queryByText(/Logs are wonderful/)).toBeInTheDocument();
    expect(screen.getByText(/place=Earth/)).toBeInTheDocument();
    expect(screen.getByText(/planet=Mars/)).toBeInTheDocument();
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
});
