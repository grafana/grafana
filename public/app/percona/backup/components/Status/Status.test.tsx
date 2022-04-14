import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Status } from './Status';
import { BackupStatus, RestoreStatus } from '../../Backup.types';
import { Messages } from './Status.messages';

jest.mock('app/percona/shared/components/Elements/Icons', () => ({
  ...jest.requireActual('app/percona/shared/components/Elements/Icons'),
  Ellipsis: jest.fn(() => <div data-testid="ellipsis" />),
}));

describe('Status', () => {
  describe('pending states', () => {
    it('should show Ellipsis when backup is pending', () => {
      render(<Status status={BackupStatus.BACKUP_STATUS_PENDING} />);
      expect(screen.getByTestId('ellipsis')).toBeInTheDocument();
      expect(screen.queryByTestId('statusMsg')).not.toBeInTheDocument();
    });

    it('should show Ellipsis when backup is in progress', () => {
      render(<Status status={BackupStatus.BACKUP_STATUS_IN_PROGRESS} />);
      expect(screen.getByTestId('ellipsis')).toBeInTheDocument();
    });

    it('should show Ellipsis when restore is in progress', () => {
      render(<Status status={RestoreStatus.RESTORE_STATUS_IN_PROGRESS} />);
      expect(screen.getByTestId('ellipsis')).toBeInTheDocument();
    });
  });

  describe('not pending states', () => {
    it('should show message when not pending', () => {
      render(<Status status={BackupStatus.BACKUP_STATUS_SUCCESS} />);
      expect(screen.queryByTestId('ellipsis')).not.toBeInTheDocument();
      expect(screen.getByTestId('statusMsg')).toBeInTheDocument();
    });
  });

  describe('logs action', () => {
    it('should have logs hidden by default', () => {
      render(<Status status={BackupStatus.BACKUP_STATUS_IN_PROGRESS} />);
      expect(screen.queryByText(Messages.logs)).not.toBeInTheDocument();
    });

    it('should call onLogClick', () => {
      const onLogClick = jest.fn();
      render(<Status showLogsAction status={BackupStatus.BACKUP_STATUS_IN_PROGRESS} onLogClick={onLogClick} />);
      userEvent.click(screen.queryByText(Messages.logs)!);
      expect(onLogClick).toHaveBeenCalled();
    });
  });
});
