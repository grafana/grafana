import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BackupLogs } from '../../Backup.types';
import { ChunkedLogsViewer } from './ChunkedLogsViewer';
import { Messages } from './ChunkedLogsViewer.messages';

describe('ChunkedLogsViewer', () => {
  const getMockedLogsGetter = (logs: BackupLogs, timeout = 10): jest.Mock => {
    return jest.fn().mockReturnValue(new Promise((resolve) => setTimeout(() => resolve(logs), timeout)));
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should show processing state in the beginning', () => {
    const getLogs = getMockedLogsGetter({ logs: [], end: false });
    render(<ChunkedLogsViewer getLogChunks={getLogs} />);
    expect(screen.getByText(Messages.loading)).toBeInTheDocument();
  });

  it('should show "no logs" message after loading is done', async () => {
    const getLogs = getMockedLogsGetter({ logs: [], end: true });
    render(<ChunkedLogsViewer getLogChunks={getLogs} />);
    await waitFor(() => {
      expect(screen.getByText(Messages.noLogs)).toBeInTheDocument();
    });
  });

  it('should show logs', async () => {
    const getLogs = getMockedLogsGetter({
      logs: [
        { id: 0, data: 'Log 1', time: '' },
        { id: 1, data: 'Log 2', time: '' },
      ],
      end: true,
    });
    render(<ChunkedLogsViewer getLogChunks={getLogs} />);
    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('Log 1') && content.includes('Log 2'))).toBeInTheDocument();
    });
  });
});
