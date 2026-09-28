import { type DataSourceInstanceListItem } from '@grafana/data';

import { detectSignal, settleSignals } from './solutionState';

const datasource: DataSourceInstanceListItem = {
  uid: 'prometheus',
  name: 'Prometheus',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
  isDefault: true,
};

describe('detectSignal', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports active with the datasource that proved usage', async () => {
    await expect(detectSignal(async () => datasource)).resolves.toEqual({
      status: 'active',
      datasource,
    });
  });

  it('reports inactive after a definitive no-data result', async () => {
    await expect(detectSignal(async () => null)).resolves.toEqual({
      status: 'inactive',
      datasource: null,
    });
  });

  it('reports unknown when the probe rejects', async () => {
    await expect(
      detectSignal(async () => {
        throw new Error('datasource unavailable');
      })
    ).resolves.toEqual({ status: 'unknown', datasource: null });
  });

  it('reports unknown when the probe exceeds its signal budget', async () => {
    jest.useFakeTimers();
    const detected = detectSignal(() => new Promise<DataSourceInstanceListItem | null>(() => {}));

    await jest.advanceTimersByTimeAsync(30_000);

    await expect(detected).resolves.toEqual({ status: 'unknown', datasource: null });
  });
});

describe('settleSignals', () => {
  it('reads a rejection as unknown and keeps the other signals', async () => {
    await expect(
      settleSignals({
        metrics: Promise.resolve('active'),
        logs: Promise.reject(new Error('logs unavailable')),
        traces: Promise.resolve('inactive'),
      })
    ).resolves.toEqual({
      metrics: 'active',
      logs: 'unknown',
      traces: 'inactive',
    });
  });
});
