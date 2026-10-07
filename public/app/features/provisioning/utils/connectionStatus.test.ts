import { type Condition, type ConnectionStatus } from 'app/api/clients/provisioning/v0alpha1';

import { isConnectionPending } from './connectionStatus';

function buildStatus(ready: Condition['status'] | undefined, tokenLastUpdated: number, healthChecked: number) {
  const status: ConnectionStatus = {
    observedGeneration: 1,
    health: { healthy: true, checked: healthChecked },
    token: { lastUpdated: tokenLastUpdated },
  };
  if (ready !== undefined) {
    status.conditions = [
      {
        type: 'Ready',
        status: ready,
        reason: 'HealthCheck',
        message: '',
        lastTransitionTime: '2024-01-01T00:00:00Z',
      },
    ];
  }
  return status;
}

describe('isConnectionPending', () => {
  it('is pending when status is undefined', () => {
    expect(isConnectionPending(undefined)).toBe(true);
  });

  it('is pending when no Ready condition exists', () => {
    expect(isConnectionPending(buildStatus(undefined, 1, 2))).toBe(true);
  });

  it('is not pending when Ready even if the token is newer than the last health check', () => {
    expect(isConnectionPending(buildStatus('True', 3, 2))).toBe(false);
  });

  it('is pending when not Ready and the token is newer than the last health check', () => {
    expect(isConnectionPending(buildStatus('False', 3, 2))).toBe(true);
  });

  it('is not pending when not Ready and the token is older than the last health check', () => {
    expect(isConnectionPending(buildStatus('False', 1, 2))).toBe(false);
  });

  it('is pending when Ready is Unknown and the token is newer than the last health check', () => {
    expect(isConnectionPending(buildStatus('Unknown', 3, 2))).toBe(true);
  });

  it('is pending when not Ready with a token but no health status', () => {
    // Older backends can omit health even though the generated type requires it.
    const status = {
      observedGeneration: 1,
      conditions: [
        {
          type: 'Ready',
          status: 'False',
          reason: 'HealthCheck',
          message: '',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
      ],
      token: { lastUpdated: 3 },
    } as ConnectionStatus;
    expect(isConnectionPending(status)).toBe(true);
  });
});
