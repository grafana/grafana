import { render, screen } from '@testing-library/react';
import React, { ComponentProps } from 'react';

import { LogsNavigationPages } from './LogsNavigationPages';

type LogsNavigationPagesProps = ComponentProps<typeof LogsNavigationPages>;

const setup = (propOverrides?: object) => {
  const props: LogsNavigationPagesProps = {
    pages: [
      {
        logsRange: { from: 1619081941000, to: 1619081945930 },
        queryRange: { from: 1619081645930, to: 1619081945930 },
      },
      {
        logsRange: { from: 1619081951000, to: 1619081955930 },
        queryRange: { from: 1619081655930, to: 1619081955930 },
      },
    ],
    currentPageIndex: 0,
    oldestLogsFirst: false,
    timeZone: 'local',
    loading: false,
    onClick: jest.fn(),
    ...propOverrides,
  };

  return render(<LogsNavigationPages {...props} />);
};

describe('LogsNavigationPages', () => {
  it('should render logs navigation pages', () => {
    setup();
    expect(screen.getByTestId('logsNavigationPages')).toBeInTheDocument();
  });
  it('should render logs pages with correct range if normal order', () => {
    setup();
    expect(screen.getByText(/02:59:05 — 02:59:01/i)).toBeInTheDocument();
    expect(screen.getByText(/02:59:15 — 02:59:11/i)).toBeInTheDocument();
  });
  it('should render logs pages with correct range if flipped order', () => {
    setup({ oldestLogsFirst: true });
    expect(screen.getByText(/02:59:11 — 02:59:15/i)).toBeInTheDocument();
    expect(screen.getByText(/02:59:01 — 02:59:05/i)).toBeInTheDocument();
  });
});
