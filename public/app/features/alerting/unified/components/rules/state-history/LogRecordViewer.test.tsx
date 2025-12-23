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

  describe('Numeric Value Formatting', () => {
    it('should format numeric values correctly in AlertInstanceValues', () => {
      const records: LogRecord[] = [
        {
          timestamp: 1681739580000,
          line: {
            current: 'Alerting',
            previous: 'Pending',
            labels: {},
            values: {
              cpu_usage: 42.987654321,
              memory_mb: 1234567.89,
              disk_io: 0.001234,
              request_count: 10000,
            },
          },
        },
      ];

      render(<LogRecordViewerByTimestamp records={records} commonLabels={[]} />);

      // Check that values are formatted correctly
      expect(screen.getByText(/cpu_usage/)).toBeInTheDocument();
      expect(screen.getByText(/42\.9877/)).toBeInTheDocument(); // 42.987654321 → 42.9877 (4 decimals)

      // Large number should use scientific notation
      expect(screen.getByText(/memory_mb/)).toBeInTheDocument();
      expect(screen.getByText(/1\.235e\+6/i)).toBeInTheDocument(); // 1234567.89 → scientific notation

      // Small number should use scientific notation
      expect(screen.getByText(/disk_io/)).toBeInTheDocument();
      expect(screen.getByText(/1\.234e-3/i)).toBeInTheDocument(); // 0.001234 → scientific notation

      // Boundary value should use standard notation
      expect(screen.getByText(/request_count/)).toBeInTheDocument();
      expect(screen.getByText(/10000/)).toBeInTheDocument(); // 10000 → 10000
    });

    it('should format various numeric ranges correctly', () => {
      const records: LogRecord[] = [
        {
          timestamp: 1681739580000,
          line: {
            current: 'Alerting',
            previous: 'Pending',
            labels: {},
            values: {
              small: 0.001,
              normal: 42.5,
              large: 123456,
              boundary_low: 0.01,
              boundary_high: 10000,
            },
          },
        },
      ];

      render(<LogRecordViewerByTimestamp records={records} commonLabels={[]} />);

      // Verify all values are present and formatted
      expect(screen.getByText(/small/)).toBeInTheDocument();
      expect(screen.getByText(/1\.000e-3/i)).toBeInTheDocument(); // 0.001 → scientific notation

      expect(screen.getByText(/normal/)).toBeInTheDocument();
      expect(screen.getByText(/42\.5/)).toBeInTheDocument(); // 42.5 → standard notation

      expect(screen.getByText(/large/)).toBeInTheDocument();
      expect(screen.getByText(/1\.235e\+5/i)).toBeInTheDocument(); // 123456 → scientific notation

      expect(screen.getByText(/boundary_low/)).toBeInTheDocument();
      expect(screen.getByText(/0\.01/)).toBeInTheDocument(); // 0.01 → standard notation (boundary)

      expect(screen.getByText(/boundary_high/)).toBeInTheDocument();
      expect(screen.getByText(/10000/)).toBeInTheDocument(); // 10000 → standard notation (boundary)
    });
  });
});
