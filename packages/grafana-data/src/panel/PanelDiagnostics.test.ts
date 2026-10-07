import { toDataFrame } from '../dataframe/processDataFrame';
import { LoadingState } from '../types/data';
import { type PanelData } from '../types/panel';
import { getDefaultTimeRange } from '../types/time';

import { getPanelDataDiagnostics, PanelDiagnosticsStore } from './PanelDiagnostics';

describe('PanelDiagnosticsStore', () => {
  it('blocks disabled callbacks and contains synchronous failures after enabling', async () => {
    const store = new PanelDiagnosticsStore();
    const source = store.createSource();
    const onClick = jest.fn(() => {
      throw new Error('Cannot repair');
    });
    const item = {
      id: 'a',
      severity: 'error' as const,
      text: 'Broken field',
      actions: [{ id: 'fix', label: 'Repair', disabled: true, onClick }],
    };
    source.set([item]);
    const entry = store.getSnapshot().items[0];
    await store.runAction(entry.id, entry.actions![0].id);
    expect(onClick).toHaveBeenCalledTimes(0);
    source.set([{ ...item, actions: [{ ...item.actions[0], disabled: false }] }]);
    await store.runAction(entry.id, entry.actions![0].id);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(Object.values(store.getSnapshot().actions)).toEqual([{ error: 'Cannot repair' }]);
  });
  it('replaces only the owning source and invalidates disposed handles', () => {
    const store = new PanelDiagnosticsStore();
    const first = store.createSource();
    const second = store.createSource();
    first.set([{ id: 'config', severity: 'warning', text: 'Choose a field' }]);
    second.set([{ id: 'config', severity: 'error', text: 'Cannot draw' }]);
    first.set([{ id: 'config', severity: 'info', text: 'Field chosen' }]);
    expect(store.getSnapshot().items.map(({ text }) => text)).toEqual(['Cannot draw', 'Field chosen']);
    first.dispose();
    first.set([{ id: 'config', severity: 'error', text: 'Stale component' }]);
    expect(store.getSnapshot().items.map(({ text }) => text)).toEqual(['Cannot draw']);
    store.clear();
    second.set([{ id: 'config', severity: 'error', text: 'Stale panel' }]);
    const next = store.createSource();
    next.set([{ id: 'config', severity: 'info', text: 'New panel' }]);
    expect(store.getSnapshot().items.map(({ text }) => text)).toEqual(['New panel']);
  });

  it('combines actions from all owners and never overrides an Assistant opt-out', async () => {
    const store = new PanelDiagnosticsStore();
    const own = jest.fn();
    const datasource = jest.fn();
    const host = jest.fn();
    store.setExternal(
      [
        {
          id: 'a',
          origin: 'query',
          severity: 'error',
          text: 'Failed',
          actions: [{ id: 'fix', label: 'Retry', onClick: own }],
        },
      ],
      () => ({
        actions: [{ id: 'fix', label: 'Authenticate', onClick: datasource }],
        assistant: 'hidden',
      })
    );
    store
      .createSource()
      .setActionResolver(() => ({ actions: [{ id: 'fix', label: 'Edit', onClick: host }], assistant: 'default' }));
    const entry = store.getSnapshot().items[0];
    expect(entry.assistant).toBe('hidden');
    expect(entry.actions?.map(({ label }) => label)).toEqual(['Retry', 'Authenticate', 'Edit']);
    for (const action of entry.actions!) {
      await store.runAction(entry.id, action.id);
    }
    expect([own.mock.calls.length, datasource.mock.calls.length, host.mock.calls.length]).toEqual([1, 1, 1]);
  });

  it('shares pending state, blocks duplicate execution, and exposes callback failures', async () => {
    const store = new PanelDiagnosticsStore();
    let reject!: (error: Error) => void;
    const onClick = jest.fn(
      () =>
        new Promise<void>((_, rejectPromise) => {
          reject = rejectPromise;
        })
    );
    store
      .createSource()
      .set([{ id: 'a', severity: 'warning', text: 'Invalid field', actions: [{ id: 'fix', label: 'Fix', onClick }] }]);
    const entry = store.getSnapshot().items[0];
    const action = entry.actions![0];
    const execution = store.runAction(entry.id, action.id);
    await store.runAction(entry.id, action.id);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(Object.values(store.getSnapshot().actions)).toEqual([{ pending: true }]);
    reject(new Error('Permission denied'));
    await execution;
    expect(Object.values(store.getSnapshot().actions)).toEqual([{ error: 'Permission denied' }]);
    expect(store.getSnapshot().items[0].text).toBe('Invalid field');
  });

  it('discards completion after removal and cannot execute removed actions', async () => {
    const store = new PanelDiagnosticsStore();
    const source = store.createSource();
    let finish!: () => void;
    const onClick = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    source.set([{ id: 'a', severity: 'error', text: 'Failed', actions: [{ id: 'retry', label: 'Retry', onClick }] }]);
    const entry = store.getSnapshot().items[0];
    const action = entry.actions![0];
    const execution = store.runAction(entry.id, action.id);
    source.set([]);
    finish();
    await execution;
    await store.runAction(entry.id, action.id);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toEqual({ generation: 0, items: [], actions: {} });
  });

  it('preserves diagnostics when a resolver throws and continues other contributions', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const store = new PanelDiagnosticsStore();
    store.createSource().setActionResolver(() => {
      throw new Error('Bad resolver');
    });
    store.createSource().setActionResolver(() => ({ assistant: 'hidden' }));
    store.createSource().set([{ id: 'a', severity: 'warning', text: 'Still visible' }]);
    expect(store.getSnapshot().items[0]).toMatchObject({ text: 'Still visible', assistant: 'hidden' });
    expect(log).toHaveBeenCalledWith('Panel diagnostic action resolver failed', expect.any(Error));
    log.mockRestore();
  });
});

describe('getPanelDataDiagnostics', () => {
  it('deduplicates matching notices while preserving query provenance and links', () => {
    const frame = (refId: string, link: string) =>
      toDataFrame({ refId, fields: [], meta: { notices: [{ severity: 'warning', text: 'Partial results', link }] } });
    const data: PanelData = {
      state: LoadingState.Done,
      timeRange: getDefaultTimeRange(),
      series: [frame('A', '/a'), frame('A', '/a'), frame('B', '/a'), frame('A', '/b')],
    };
    expect(getPanelDataDiagnostics(data).map(({ refId, link, text }) => ({ refId, link, text }))).toEqual([
      { refId: 'A', link: '/a', text: 'Partial results' },
      { refId: 'B', link: '/a', text: 'Partial results' },
      { refId: 'A', link: '/b', text: 'Partial results' },
    ]);
  });
});
