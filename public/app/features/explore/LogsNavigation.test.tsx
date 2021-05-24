import React, { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { LogsSortOrder } from '@grafana/data';
import LogsNavigation from './LogsNavigation';

type LogsNavigationProps = ComponentProps<typeof LogsNavigation>;

const setup = (propOverrides?: object) => {
  const props: LogsNavigationProps = {
    absoluteRange: { from: 1619081645930, to: 1619081945930 },
    timeZone: 'local',
    queries: [],
    loading: false,
    logsSortOrder: undefined,
    visibleRange: { from: 1619081941000, to: 1619081945930 },
    onChangeTime: jest.fn(),
    scrollToTopLogs: jest.fn(),
    addResultsToCache: jest.fn(),
    clearCache: jest.fn(),
    ...propOverrides,
  };

  return render(<LogsNavigation {...props} />);
};

describe('LogsNavigation', () => {
  it('should always render 3 navigation buttons', () => {
    setup();
    expect(screen.getByTestId('newerLogsButton')).toBeInTheDocument();
    expect(screen.getByTestId('olderLogsButton')).toBeInTheDocument();
    expect(screen.getByTestId('scrollToTop')).toBeInTheDocument();
  });

  it('should render 3 navigation buttons in correct order when default logs order', () => {
    const { container } = setup();
    const expectedOrder = ['newerLogsButton', 'olderLogsButton', 'scrollToTop'];
    const elements = container.querySelectorAll(
      '[data-testid=newerLogsButton],[data-testid=olderLogsButton],[data-testid=scrollToTop]'
    );
    expect(Array.from(elements).map((el) => el.getAttribute('data-testid'))).toMatchObject(expectedOrder);
  });

  it('should render 3 navigation buttons in correect order when flipped logs order', () => {
    const { container } = setup({ logsSortOrder: LogsSortOrder.Ascending });
    const expectedOrder = ['olderLogsButton', 'newerLogsButton', 'scrollToTop'];
    const elements = container.querySelectorAll(
      '[data-testid=newerLogsButton],[data-testid=olderLogsButton],[data-testid=scrollToTop]'
    );
    expect(Array.from(elements).map((el) => el.getAttribute('data-testid'))).toMatchObject(expectedOrder);
  });

  it('should disable fetch buttons when logs are loading', () => {
    setup({ loading: true });
    const olderLogsButton = screen.getByTestId('olderLogsButton');
    const newerLogsButton = screen.getByTestId('newerLogsButton');
    expect(olderLogsButton).toBeDisabled();
    expect(newerLogsButton).toBeDisabled();
  });

  it('should render logs navigation pages section', () => {
    setup();
    expect(screen.getByTestId('logsNavigationPages')).toBeInTheDocument();
  });
});
