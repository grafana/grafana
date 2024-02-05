import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ComponentProps } from 'react';

import { LogsSortOrder } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

import LogsNavigation from './LogsNavigation';

// we have to mock out reportInteraction, otherwise it crashes the test.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: () => null,
}));

type LogsNavigationProps = ComponentProps<typeof LogsNavigation>;
const defaultProps: LogsNavigationProps = {
  absoluteRange: { from: 1637319381811, to: 1637322981811 },
  timeZone: 'local',
  queries: [],
  loading: false,
  logsSortOrder: undefined,
  visibleRange: { from: 1637322959000, to: 1637322981811 },
  onChangeTime: jest.fn(),
  scrollToTopLogs: jest.fn(),
  addResultsToCache: jest.fn(),
  clearCache: jest.fn(),
};

const setup = (propOverrides?: Partial<LogsNavigationProps>) => {
  const props = {
    ...defaultProps,
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

  it('should render 3 navigation buttons in correct order when flipped logs order', () => {
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

  it('should correctly request older logs when flipped order', async () => {
    const onChangeTimeMock = jest.fn();
    const { rerender } = setup({ onChangeTime: onChangeTimeMock });
    await userEvent.click(screen.getByTestId('olderLogsButton'));
    expect(onChangeTimeMock).toHaveBeenCalledWith({ from: 1637319359000, to: 1637322959000 });

    rerender(
      <LogsNavigation
        {...defaultProps}
        absoluteRange={{ from: 1637319359000, to: 1637322959000 }}
        visibleRange={{ from: 1637322938000, to: 1637322959000 }}
        onChangeTime={onChangeTimeMock}
        logsSortOrder={LogsSortOrder.Ascending}
      />
    );
    await userEvent.click(screen.getByTestId('olderLogsButton'));
    expect(onChangeTimeMock).toHaveBeenCalledWith({ from: 1637319338000, to: 1637322938000 });
  });

  it('should correctly display the active page', async () => {
    const queries: DataQuery[] = [];
    const { rerender } = setup({
      absoluteRange: { from: 1704737384139, to: 1704737684139 },
      visibleRange: { from: 1704737384207, to: 1704737683316 },
      queries,
      logsSortOrder: LogsSortOrder.Descending,
    });

    expect(await screen.findByTestId('page1')).toBeInTheDocument();
    expect(screen.getByTestId('page1').firstChild).toHaveClass('selectedBg');

    expect(screen.queryByTestId('page2')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('olderLogsButton'));

    rerender(
      <LogsNavigation
        {...defaultProps}
        absoluteRange={{ from: 1704737084207, to: 1704737384207 }}
        visibleRange={{ from: 1704737084627, to: 1704737383765 }}
        onChangeTime={jest.fn()}
        logsSortOrder={LogsSortOrder.Descending}
        queries={queries}
      />
    );

    expect(await screen.findByTestId('page1')).toBeInTheDocument();
    expect(screen.getByTestId('page1').firstChild).not.toHaveClass('selectedBg');

    expect(await screen.findByTestId('page2')).toBeInTheDocument();
    expect(screen.getByTestId('page2').firstChild).toHaveClass('selectedBg');

    expect(screen.queryByTestId('page3')).not.toBeInTheDocument();
  });

  it('should reset the scroll when pagination is clicked', async () => {
    const scrollToTopLogsMock = jest.fn();
    setup({ scrollToTopLogs: scrollToTopLogsMock });

    expect(scrollToTopLogsMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('olderLogsButton'));
    expect(scrollToTopLogsMock).toHaveBeenCalled();
  });

  it('should not trigger actions while loading', async () => {
    const scrollToTopLogs = jest.fn();
    const changeTimeMock = jest.fn();
    setup({ scrollToTopLogs, onChangeTime: changeTimeMock, loading: true });

    expect(scrollToTopLogs).not.toHaveBeenCalled();
    expect(changeTimeMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('olderLogsButton'));
    await userEvent.click(screen.getByTestId('newerLogsButton'));
    expect(scrollToTopLogs).not.toHaveBeenCalled();
    expect(changeTimeMock).not.toHaveBeenCalled();
  });

  it('should not add results to cache unless pagination is used', async () => {
    const addResultsToCache = jest.fn();
    setup({ addResultsToCache });

    expect(addResultsToCache).not.toHaveBeenCalled();
    expect(screen.getByTestId('olderLogsButton')).not.toBeDisabled();
    expect(screen.getByTestId('newerLogsButton')).toBeDisabled();

    await userEvent.click(screen.getByTestId('olderLogsButton'));
    await userEvent.click(screen.getByTestId('newerLogsButton'));

    expect(addResultsToCache).toHaveBeenCalledTimes(1);
  });
});
