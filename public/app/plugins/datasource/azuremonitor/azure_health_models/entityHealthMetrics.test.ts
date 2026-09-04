import { getEntityHealthMetrics } from './entityHealthMetrics';
import { type HealthModelEntity } from './types';

function entity(properties: HealthModelEntity['properties']): HealthModelEntity {
  return {
    id: '/entities/example',
    name: 'example',
    type: 'Microsoft.CloudHealth/healthmodels/entities',
    properties,
  };
}

describe('getEntityHealthMetrics', () => {
  test('reads Azure Resource Health status, including availability and summary', () => {
    // Shape captured from a live Microsoft.CloudHealth response.
    const metrics = getEntityHealthMetrics(
      entity({
        signalGroups: {
          azureResource: {
            resourceHealth: {
              signalName: 'ResourceHealth-43d995c9',
              status: {
                healthState: 'Healthy',
                reportedAt: '2026-09-01T17:47:53.1899912+00:00',
                availabilityState: 'Available',
                summary: "There aren't any known problems affecting this account.",
              },
            },
          },
        },
      })
    );

    expect(metrics.availabilityState).toBe('Available');
    expect(metrics.summary).toBe("There aren't any known problems affecting this account.");
    expect(metrics.signals).toHaveLength(1);
    expect(metrics.signals[0].name).toBe('ResourceHealth-43d995c9');
  });

  test('reads Log Analytics signals held in an array', () => {
    const metrics = getEntityHealthMetrics(
      entity({
        signalGroups: {
          azureLogAnalytics: {
            signals: [
              {
                displayName: 'Error rate',
                status: { healthState: 'Healthy', value: 0, reportedAt: '2026-09-01T17:51:03Z' },
              },
              {
                displayName: 'Latency',
                status: { healthState: 'Degraded', value: 42, reportedAt: '2026-09-01T17:51:05Z' },
              },
            ],
          },
        },
      })
    );

    expect(metrics.signals.map((signal) => signal.name)).toEqual(['Latency', 'Error rate']);
    expect(metrics.signals[0].value).toBe(42);
  });

  test('returns empty metrics for a group that carries only configuration', () => {
    // `dependencies` describes aggregation rules and reports no status of its own.
    const metrics = getEntityHealthMetrics(
      entity({ signalGroups: { dependencies: { aggregationType: 'WorstOf', ignoreUnknown: true } } })
    );

    expect(metrics.signals).toEqual([]);
  });

  test('returns empty metrics when the entity has no signal groups', () => {
    const metrics = getEntityHealthMetrics(entity({ displayName: 'Root' }));

    expect(metrics.signals).toEqual([]);
    expect(metrics.alertSeverities).toEqual([]);
  });

  test('orders alert severities most severe first', () => {
    const metrics = getEntityHealthMetrics(
      entity({
        alerts: {
          unhealthy: { severity: 'Sev3' },
          degraded: { severity: 'Sev1' },
        },
      })
    );

    expect(metrics.alertSeverities).toEqual(['Sev1', 'Sev3']);
  });

  test('deduplicates repeated alert severities', () => {
    const metrics = getEntityHealthMetrics(
      entity({ alerts: { unhealthy: { severity: 'Sev1' }, degraded: { severity: 'Sev1' } } })
    );

    expect(metrics.alertSeverities).toEqual(['Sev1']);
  });

  test('keeps signals that report a health state without a timestamp', () => {
    const metrics = getEntityHealthMetrics(
      entity({ signalGroups: { custom: { probe: { status: { healthState: 'Unknown' } } } } })
    );

    expect(metrics.signals).toHaveLength(1);
    expect(metrics.signals[0].healthState).toBe('Unknown');
  });

  test('sorts timestamped signals ahead of undated ones', () => {
    const metrics = getEntityHealthMetrics(
      entity({
        signalGroups: {
          custom: {
            signals: [
              { displayName: 'Undated', status: { healthState: 'Unknown' } },
              { displayName: 'Dated', status: { healthState: 'Healthy', reportedAt: '2026-09-01T12:00:00Z' } },
            ],
          },
        },
      })
    );

    expect(metrics.signals[0].name).toBe('Dated');
  });

  test('falls back to a readable label derived from the signal group key', () => {
    const metrics = getEntityHealthMetrics(
      entity({ signalGroups: { azureLogAnalytics: { status: { healthState: 'Healthy' } } } })
    );

    expect(metrics.signals[0].name).toBe('Azure log analytics');
  });
});
