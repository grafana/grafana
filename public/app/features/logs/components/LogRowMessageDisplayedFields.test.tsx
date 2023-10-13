import { render, screen } from '@testing-library/react';
import React from 'react';

import { createTheme, LogLevel } from '@grafana/data';

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
    expect(screen.queryByText('Logs are wonderful')).not.toBeInTheDocument();
    expect(screen.getByText(/place=Earth/)).toBeInTheDocument();
    expect(screen.getByText(/planet=Mars/)).toBeInTheDocument();
  });
});
