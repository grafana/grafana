import { render, screen } from '@testing-library/react';
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
});
