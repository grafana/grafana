import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LOG_LINE_BODY_FIELD_NAME } from '../fieldSelector/logFields';
import { createLogLine } from '../mocks/logRow';

import { LogLineDetailsLog } from './LogLineDetailsLog';
import { LogListContext, type LogListContextData } from './LogListContext';
import { defaultValue } from './__mocks__/LogListContext';

jest.mock('./LogListContext');

const log = createLogLine({ entry: 'some log line' });

const renderLog = (contextOverrides: Partial<LogListContextData> = {}) => {
  return render(
    <LogListContext.Provider value={{ ...defaultValue, ...contextOverrides }}>
      <LogLineDetailsLog log={log} syntaxHighlighting={false} />
    </LogListContext.Provider>
  );
};

describe('LogLineDetailsLog', () => {
  test('renders the log line body', () => {
    renderLog();

    expect(screen.getByText('some log line')).toBeInTheDocument();
  });

  test('calls onClickFilterString with the log line and refId', async () => {
    const onClickFilterString = jest.fn();
    renderLog({ onClickFilterString });

    await userEvent.click(screen.getByLabelText('Filter for this log line'));

    expect(onClickFilterString).toHaveBeenCalledTimes(1);
    expect(onClickFilterString).toHaveBeenCalledWith('some log line', 'A');
  });

  test('calls onClickFilterOutString with the log line and refId', async () => {
    const onClickFilterOutString = jest.fn();
    renderLog({ onClickFilterOutString });

    await userEvent.click(screen.getByLabelText('Filter out this log line'));

    expect(onClickFilterOutString).toHaveBeenCalledTimes(1);
    expect(onClickFilterOutString).toHaveBeenCalledWith('some log line', 'A');
  });

  test('does not render filter buttons when the callbacks are not provided', () => {
    renderLog();

    expect(screen.getByText('some log line')).toBeInTheDocument();
    expect(screen.queryByLabelText('Filter for this log line')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Filter out this log line')).not.toBeInTheDocument();
  });

  test('calls onClickShowField with the log line body field when displayed fields are used', async () => {
    const onClickShowField = jest.fn();
    renderLog({
      displayedFields: ['app'],
      onClickShowField,
      onClickHideField: jest.fn(),
    });

    expect(screen.getByText('some log line')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Show log line'));

    expect(onClickShowField).toHaveBeenCalledTimes(1);
    expect(onClickShowField).toHaveBeenCalledWith(LOG_LINE_BODY_FIELD_NAME);
  });

  test('calls onClickHideField with the log line body field when the log line is already displayed', async () => {
    const onClickHideField = jest.fn();
    renderLog({
      displayedFields: ['app', LOG_LINE_BODY_FIELD_NAME],
      onClickHideField,
      onClickShowField: jest.fn(),
    });

    expect(screen.getByText('some log line')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Hide log line'));

    expect(onClickHideField).toHaveBeenCalledTimes(1);
    expect(onClickHideField).toHaveBeenCalledWith(LOG_LINE_BODY_FIELD_NAME);
  });

  test('does not show a Show log line button when displayed fields are empty', () => {
    renderLog({
      displayedFields: [],
      onClickShowField: jest.fn(),
      onClickHideField: jest.fn(),
    });

    expect(screen.getByText('some log line')).toBeInTheDocument();
    expect(screen.queryByLabelText('Show log line')).not.toBeInTheDocument();
  });
});
