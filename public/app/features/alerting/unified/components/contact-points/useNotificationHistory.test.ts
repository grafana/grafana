import { transformCountsToIntegrations } from './useNotificationHistory';

describe('useNotificationHistory', () => {
  describe('transformCountsToIntegrations', () => {
    const receiverName = 'my-receiver';

    // Helper: build an IntegrationCountsResult from a flat list of integration specs
    const makeResult = (
      integrations: Array<{
        type: string;
        index: number;
        success?: number;
        failed?: number;
        lastAttempt?: string;
        duration?: string;
        error?: string | null;
      }>
    ) => {
      const byKey = new Map();
      for (const { type, index, success = 0, failed = 0, lastAttempt = '', duration = '', error = null } of integrations) {
        byKey.set(`${type}:${index}`, {
          integrationType: type,
          integrationIndex: index,
          successCount: success,
          failedCount: failed,
          lastNotifyAttempt: lastAttempt,
          lastNotifyAttemptDuration: duration,
          lastNotifyAttemptError: error,
        });
      }
      return { byKey };
    };

    it('returns a single zeroed entry when there are no counts', () => {
      const result = transformCountsToIntegrations(makeResult([]), receiverName);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: receiverName,
        totalAttempts: 0,
        failedAttempts: 0,
        successAttempts: 0,
        lastNotifyAttempt: '',
        lastNotifyAttemptDuration: '',
        lastNotifyAttemptError: null,
      });
    });

    it('returns one entry per (type, integrationIndex) pair', () => {
      // Mirrors the real API: receiver with webhook[0] and email[0] — both integrationIndex=0
      // because integrationIndex is a per-type occurrence counter, not overall position.
      const result = transformCountsToIntegrations(
        makeResult([
          { type: 'webhook', index: 0, failed: 7, error: 'connection refused' },
          { type: 'email', index: 0, failed: 7, error: 'SMTP error' },
        ]),
        receiverName
      );

      expect(result).toHaveLength(2);

      const webhook = result.find((r) => r.integrationType === 'webhook');
      const email = result.find((r) => r.integrationType === 'email');

      expect(webhook).toMatchObject({ integrationType: 'webhook', integrationIndex: 0, totalAttempts: 7, failedAttempts: 7 });
      expect(email).toMatchObject({ integrationType: 'email', integrationIndex: 0, totalAttempts: 7, failedAttempts: 7 });
    });

    it('correctly sums success and failed counts into totalAttempts', () => {
      const result = transformCountsToIntegrations(
        makeResult([{ type: 'slack', index: 0, success: 3, failed: 2 }]),
        receiverName
      );

      expect(result[0]).toMatchObject({ totalAttempts: 5, successAttempts: 3, failedAttempts: 2 });
    });

    it('handles two integrations of the same type using incrementing integrationIndex', () => {
      const result = transformCountsToIntegrations(
        makeResult([
          { type: 'email', index: 0, success: 5 },
          { type: 'email', index: 1, failed: 2 },
        ]),
        receiverName
      );

      expect(result).toHaveLength(2);
      const first = result.find((r) => r.integrationIndex === 0);
      const second = result.find((r) => r.integrationIndex === 1);
      expect(first).toMatchObject({ integrationType: 'email', successAttempts: 5 });
      expect(second).toMatchObject({ integrationType: 'email', failedAttempts: 2 });
    });

    it('includes lastNotifyAttempt metadata', () => {
      const result = transformCountsToIntegrations(
        makeResult([
          {
            type: 'webhook',
            index: 0,
            success: 1,
            lastAttempt: '2024-01-01T00:00:00Z',
            duration: '150.00ms',
          },
        ]),
        receiverName
      );

      expect(result[0]).toMatchObject({
        lastNotifyAttempt: '2024-01-01T00:00:00Z',
        lastNotifyAttemptDuration: '150.00ms',
        lastNotifyAttemptError: null,
      });
    });
  });
});
