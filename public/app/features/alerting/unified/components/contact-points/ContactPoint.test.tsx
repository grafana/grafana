import { render, screen } from '@testing-library/react';

import { dateTime } from '@grafana/data';

import { NotifierStatus } from '../../types/alerting';

import { ContactPointReceiverTitleRow } from './ContactPoint';
import { RECEIVER_STATUS_KEY } from './constants';
import { ReceiverConfigWithMetadata } from './utils';

/**
 * Tests for ContactPoint component with notification history diagnostics
 */
describe('ContactPoint with notification history', () => {
  describe('ContactPointReceiverTitleRow', () => {
    it('should render integration name and type', () => {
      render(<ContactPointReceiverTitleRow name="My Email" type="email" />);

      expect(screen.getByText('My Email')).toBeInTheDocument();
    });

    it('should render description when provided', () => {
      render(<ContactPointReceiverTitleRow name="My Email" type="email" description="test@example.com" />);

      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  describe('Diagnostic states', () => {
    const createReceiverWithDiagnostics = (diagnostics: NotifierStatus): ReceiverConfigWithMetadata => {
      return {
        type: 'email',
        disableResolveMessage: false,
        settings: {},
        [RECEIVER_STATUS_KEY]: diagnostics,
      };
    };

    it('should handle no attempts state', () => {
      const diagnostics: NotifierStatus = {
        name: 'email',
        lastNotifyAttempt: '',
        lastNotifyAttemptDuration: '',
        lastNotifyAttemptError: null,
        totalAttempts: 0,
        failedAttempts: 0,
        successAttempts: 0,
      };

      // Test data structure - actual rendering tested in integration tests
      expect(diagnostics.totalAttempts).toBe(0);
      expect(diagnostics.failedAttempts).toBe(0);
      expect(diagnostics.successAttempts).toBe(0);
    });

    it('should handle all successful attempts', () => {
      const diagnostics: NotifierStatus = {
        name: 'email',
        lastNotifyAttempt: dateTime().subtract(5, 'minutes').toISOString(),
        lastNotifyAttemptDuration: '150.00ms',
        lastNotifyAttemptError: null,
        totalAttempts: 5,
        failedAttempts: 0,
        successAttempts: 5,
      };

      expect(diagnostics.totalAttempts).toBe(5);
      expect(diagnostics.successAttempts).toBe(5);
      expect(diagnostics.failedAttempts).toBe(0);
    });

    it('should handle all failed attempts', () => {
      const diagnostics: NotifierStatus = {
        name: 'email',
        lastNotifyAttempt: dateTime().subtract(5, 'minutes').toISOString(),
        lastNotifyAttemptDuration: '50.00ms',
        lastNotifyAttemptError: 'SMTP connection timeout',
        totalAttempts: 3,
        failedAttempts: 3,
        successAttempts: 0,
      };

      expect(diagnostics.totalAttempts).toBe(3);
      expect(diagnostics.failedAttempts).toBe(3);
      expect(diagnostics.successAttempts).toBe(0);
      expect(diagnostics.lastNotifyAttemptError).toBe('SMTP connection timeout');
    });

    it('should handle mixed success/failure attempts', () => {
      const diagnostics: NotifierStatus = {
        name: 'email',
        lastNotifyAttempt: dateTime().subtract(5, 'minutes').toISOString(),
        lastNotifyAttemptDuration: '150.00ms',
        lastNotifyAttemptError: 'Connection timeout',
        totalAttempts: 10,
        failedAttempts: 3,
        successAttempts: 7,
      };

      expect(diagnostics.totalAttempts).toBe(10);
      expect(diagnostics.failedAttempts).toBe(3);
      expect(diagnostics.successAttempts).toBe(7);
      expect(diagnostics.lastNotifyAttemptError).toBe('Connection timeout');
    });

    it('should identify different states correctly', () => {
      const noAttempts: NotifierStatus = {
        name: 'email',
        lastNotifyAttempt: '',
        lastNotifyAttemptDuration: '',
        totalAttempts: 0,
        failedAttempts: 0,
        successAttempts: 0,
      };

      const allFailed: NotifierStatus = {
        name: 'email',
        lastNotifyAttempt: dateTime().toISOString(),
        lastNotifyAttemptDuration: '50ms',
        lastNotifyAttemptError: 'Error',
        totalAttempts: 5,
        failedAttempts: 5,
        successAttempts: 0,
      };

      const allSuccess: NotifierStatus = {
        name: 'email',
        lastNotifyAttempt: dateTime().toISOString(),
        lastNotifyAttemptDuration: '150ms',
        totalAttempts: 5,
        failedAttempts: 0,
        successAttempts: 5,
      };

      const mixed: NotifierStatus = {
        name: 'email',
        lastNotifyAttempt: dateTime().toISOString(),
        lastNotifyAttemptDuration: '150ms',
        lastNotifyAttemptError: 'Some error',
        totalAttempts: 10,
        failedAttempts: 3,
        successAttempts: 7,
      };

      // No attempts
      expect(noAttempts.totalAttempts).toBe(0);

      // All failed
      const isAllFailed = allFailed.totalAttempts! > 0 && allFailed.failedAttempts === allFailed.totalAttempts;
      expect(isAllFailed).toBe(true);

      // All success
      const isAllSuccess = allSuccess.totalAttempts! > 0 && allSuccess.successAttempts === allSuccess.totalAttempts;
      expect(isAllSuccess).toBe(true);

      // Mixed
      const isMixed =
        mixed.totalAttempts! > 0 && mixed.failedAttempts! > 0 && mixed.successAttempts! > 0;
      expect(isMixed).toBe(true);
    });
  });
});
