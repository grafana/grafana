import { render, screen, within } from '@testing-library/react';
import React from 'react';

import { createTheme } from '@grafana/data';

import { UnThemedLogMessageAnsi as LogMessageAnsi } from './LogMessageAnsi';

describe('<LogMessageAnsi />', () => {
  it('renders string without ANSI codes', () => {
    render(<LogMessageAnsi value="Lorem ipsum" theme={createTheme()} />);

    expect(screen.queryByTestId('ansiLogLine')).not.toBeInTheDocument();
    expect(screen.queryByText('Lorem ipsum')).toBeInTheDocument();
  });
  it('renders string with ANSI codes', () => {
    const value = 'Lorem \u001B[31mipsum\u001B[0m et dolor';
    render(<LogMessageAnsi value={value} theme={createTheme()} />);

    expect(screen.queryByTestId('ansiLogLine')).toBeInTheDocument();
    expect(screen.getAllByTestId('ansiLogLine')).toHaveLength(1);
    expect(screen.getAllByTestId('ansiLogLine').at(0)).toHaveAttribute('style', expect.stringMatching('color'));

    const { getByText } = within(screen.getAllByTestId('ansiLogLine').at(0)!);
    expect(getByText('ipsum')).toBeInTheDocument();
  });
  it('renders string with ANSI codes with correctly converted css classnames', () => {
    const value = 'Lorem \u001B[1;32mIpsum';
    render(<LogMessageAnsi value={value} theme={createTheme()} />);

    expect(screen.queryByTestId('ansiLogLine')).toBeInTheDocument();
    expect(screen.getAllByTestId('ansiLogLine')).toHaveLength(1);

    expect(screen.getAllByTestId('ansiLogLine').at(0)).toHaveAttribute('style', expect.stringMatching('font-weight'));
  });
  it('renders string with ANSI dim code with appropriate themed color', () => {
    const value = 'Lorem \u001B[1;2mIpsum';
    const theme = createTheme();
    render(<LogMessageAnsi value={value} theme={createTheme()} />);

    expect(screen.queryByTestId('ansiLogLine')).toBeInTheDocument();
    expect(screen.getAllByTestId('ansiLogLine')).toHaveLength(1);

    expect(screen.getAllByTestId('ansiLogLine').at(0)).toHaveStyle({ color: theme.colors.text.secondary });
  });
});
