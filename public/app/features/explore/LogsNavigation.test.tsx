import React, { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { LogsSortOrder } from '@grafana/data';
import LogsNavigation from './LogsNavigation';

type LogsNavigationrProps = ComponentProps<typeof LogsNavigation>;

const setup = (propOverrides?: object) => {
  const props: LogsNavigationrProps = {
    absoluteRange: { from: 1619081645930, to: 1619081945930 },
    timeZone: 'local',
    queries: [],
    loading: false,
    logsSortOrder: undefined,
    visibleRange: { from: 1619081941000, to: 1619081945930 },
    onChangeTime: jest.fn(),
    ...propOverrides,
  };

  return render(<LogsNavigation {...props} />);
};

describe('LogsNavigation', () => {
  it('should render fetch logs button on bottom when default logs order', () => {
    setup();
    expect(screen.getByTestId('fetchLogsBottom')).toBeInTheDocument();
    expect(screen.queryByTestId('fetchLogsTop')).not.toBeInTheDocument();
  });
  it('should render fetch logs button on top when flipped logs order', () => {
    setup({ logsSortOrder: LogsSortOrder.Ascending });
    expect(screen.getByTestId('fetchLogsTop')).toBeInTheDocument();
    expect(screen.queryByTestId('fetchLogsBottom')).not.toBeInTheDocument();
  });
  it('should disable button to fetch logs when loading', () => {
    setup({ loading: true });
    const button = screen.getByTestId('fetchLogsBottom');
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });
  it('should render logs page with correct range', () => {
    setup();
    expect(screen.getByText(/02:59:05 — 02:59:01/i)).toBeInTheDocument();
  });
});
