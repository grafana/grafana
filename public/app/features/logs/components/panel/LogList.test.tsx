import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoreApp, getDefaultTimeRange, LogRowModel, LogsDedupStrategy, LogsSortOrder } from '@grafana/data';

import { createLogRow } from '../__mocks__/logRow';

import { LogList, Props } from './LogList';

describe('LogList', () => {
  let logs: LogRowModel[], defaultProps: Props;
  beforeEach(() => {
    logs = [
      createLogRow({ uid: '1', labels: { name_of_the_label: 'value of the label' } }),
      createLogRow({ uid: '2' }),
    ];
    defaultProps = {
      app: CoreApp.Explore,
      containerElement: document.createElement('div'),
      dedupStrategy: LogsDedupStrategy.none,
      displayedFields: [],
      enableLogDetails: false,
      logs,
      showControls: false,
      showTime: false,
      sortOrder: LogsSortOrder.Descending,
      timeRange: getDefaultTimeRange(),
      timeZone: 'browser',
      wrapLogMessage: false,
    };
  });

  test('Renders a list of logs without controls ', async () => {
    render(<LogList {...defaultProps} />);
    expect(screen.getByText('log message 1')).toBeInTheDocument();
    expect(screen.getByText('log message 2')).toBeInTheDocument();
    expect(screen.queryByLabelText('Scroll to bottom')).not.toBeInTheDocument();
  });

  test('Renders a list of logs with controls', async () => {
    render(<LogList {...defaultProps} showControls={true} />);
    expect(screen.getByText('log message 1')).toBeInTheDocument();
    expect(screen.getByText('log message 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Scroll to bottom')).toBeInTheDocument();
  });

  test('Reports mouse over events', async () => {
    const onLogRowHover = jest.fn();
    render(<LogList {...defaultProps} onLogLineHover={onLogRowHover} />);
    await userEvent.hover(screen.getByText('log message 1'));
    expect(onLogRowHover).toHaveBeenCalledTimes(1);
    expect(onLogRowHover).toHaveBeenCalledWith(expect.objectContaining(logs[0]));
  });

  test('Supports showing log details', async () => {
    const onClickFilterLabel = jest.fn();
    const onClickFilterOutLabel = jest.fn();
    const onClickShowField = jest.fn();

    render(
      <LogList
        {...defaultProps}
        enableLogDetails={true}
        onClickFilterLabel={onClickFilterLabel}
        onClickFilterOutLabel={onClickFilterOutLabel}
        onClickShowField={onClickShowField}
      />
    );

    await userEvent.click(screen.getByText('log message 1'));
    await screen.findByText('Fields');

    expect(screen.getByText('name_of_the_label')).toBeInTheDocument();
    expect(screen.getByText('value of the label')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Filter for value in query A'));
    expect(onClickFilterLabel).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByLabelText('Filter out value in query A'));
    expect(onClickFilterOutLabel).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByLabelText('Show this field instead of the message'));
    expect(onClickShowField).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByLabelText('Close log details'));

    expect(screen.queryByText('Fields')).not.toBeInTheDocument();
    expect(screen.queryByText('Close log details')).not.toBeInTheDocument();
  });

  test('Allows people to select text without opening log details', async () => {
    const spy = jest.spyOn(document, 'getSelection');
    spy.mockReturnValue({
      toString: () => 'selected log line',
      removeAllRanges: () => {},
      addRange: (range: Range) => {},
    } as Selection);

    render(<LogList {...defaultProps} enableLogDetails={true} />);

    await userEvent.click(screen.getByText('log message 1'));

    expect(screen.queryByText('name_of_the_label')).not.toBeInTheDocument();
    expect(screen.queryByText('value of the label')).not.toBeInTheDocument();
    expect(screen.queryByText('Fields')).not.toBeInTheDocument();
    expect(screen.queryByText('Close log details')).not.toBeInTheDocument();

    spy.mockRestore();
  });
});
