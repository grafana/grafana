import { render, screen, within } from '@testing-library/react';
import { byRole } from 'testing-library-selector';

import { LogRecordViewerByTimestamp } from './LogRecordViewer';
import { LogRecord } from './common';

const ui = {
  log: byRole('list', { name: 'State history by timestamp' }),
};

describe('LogRecordViewerByTimestamp', () => {
  it('should group the same timestamps into one group', () => {
    const records: LogRecord[] = [
      { timestamp: 1681739580000, line: { current: 'Alerting', previous: 'Pending', labels: { foo: 'bar' } } },
      { timestamp: 1681739580000, line: { current: 'Alerting', previous: 'Pending', labels: { severity: 'warning' } } },
      { timestamp: 1681739600000, line: { current: 'Normal', previous: 'Alerting', labels: { foo: 'bar' } } },
      { timestamp: 1681739600000, line: { current: 'Normal', previous: 'Alerting', labels: { severity: 'warning' } } },
    ];

    render(<LogRecordViewerByTimestamp records={records} commonLabels={[]} />);

    const logElement = ui.log.get();
    expect(logElement).toBeInTheDocument();

    const entry1 = screen.getByTestId(1681739580000);
    const entry2 = screen.getByTestId(1681739600000);

    expect(entry1).toHaveTextContent('foo=bar');
    expect(entry1).toHaveTextContent('severity=warning');

    expect(entry2).toHaveTextContent('foo=bar');
    expect(entry2).toHaveTextContent('severity=warning');
  });

  it('renders error row only when current state is Error and shows message', () => {
    const ts = 1681739700000;
    const records: LogRecord[] = [
      {
        timestamp: ts,
        line: { current: 'Error (timeout)', previous: 'Pending', labels: { foo: 'bar' }, error: 'timeout' },
      },
      { timestamp: ts, line: { current: 'Normal', previous: 'Alerting', labels: { foo: 'baz' } } },
      {
        timestamp: ts,
        line: {
          current: 'Error',
          previous: 'Pending',
          labels: { error: 'explicit message' },
          error: 'explicit message',
        },
      },
    ];

    render(<LogRecordViewerByTimestamp records={records} commonLabels={[]} />);

    const errorRows = screen.getAllByTestId('state-history-error');
    expect(errorRows).toHaveLength(2);
    expect(within(errorRows[0]).getByText(/Error message:/)).toBeInTheDocument();
    expect(within(errorRows[0]).getByText(/timeout/)).toBeInTheDocument();
    expect(within(errorRows[1]).getByText(/Error message:/)).toBeInTheDocument();
    expect(within(errorRows[1]).getByText(/explicit message/)).toBeInTheDocument();
  });
});
