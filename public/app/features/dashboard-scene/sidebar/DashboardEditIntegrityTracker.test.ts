import { DashboardEditIntegrityTracker } from './DashboardEditIntegrityTracker';

it('reports detached snapshots once, retaining only new changes after each check', () => {
  const model = { schemaVersion: 42, title: 'original', tags: ['one'] };
  const tracker = new DashboardEditIntegrityTracker(() => model);
  model.tags.push('two');
  tracker.check();
  tracker.check();
  model.title = 'untracked';
  tracker.check('perform');
  expect(tracker.state.records.map(({ trigger, changes }) => ({ trigger, changes }))).toEqual([
    { trigger: 'manual', changes: [{ op: 'add', path: '/tags/1' }] },
    { trigger: 'perform', changes: [{ op: 'replace', path: '/title' }] },
  ]);
});

it('accepts changes inside actions and nested operations, including partial failures', () => {
  const model = { schemaVersion: 42, title: 'original' };
  const tracker = new DashboardEditIntegrityTracker(() => model);
  tracker.run('perform', () => {
    model.title = 'changed';
    tracker.run('nested', () => {
      model.title = 'nested';
    });
  });
  expect(() =>
    tracker.run('failing', () => {
      model.title = 'partial';
      throw new Error('failed action');
    })
  ).toThrow('failed action');
  tracker.check();
  expect(tracker.state.records).toEqual([]);
  model.title = 'outside';
  tracker.check();
  expect(tracker.state.records[0].changes).toEqual([{ op: 'replace', path: '/title' }]);
});

it('preserves uncertain committed intervals separately from untracked changes', () => {
  const model = { schemaVersion: 42, title: 'original' };
  const tracker = new DashboardEditIntegrityTracker(() => model);
  model.title = 'committed';
  tracker.check('resize', 'committed');
  tracker.check();
  expect(tracker.state.records).toEqual([
    expect.objectContaining({ kind: 'committed', trigger: 'resize', changes: [{ op: 'replace', path: '/title' }] }),
  ]);
});

it('recovers from snapshot failures without blocking actions or claiming a verified interval', () => {
  const snapshot = jest.fn().mockReturnValue({ title: 'original' });
  const tracker = new DashboardEditIntegrityTracker(snapshot);
  snapshot.mockImplementationOnce(() => {
    throw new Error('serializer failed');
  });
  tracker.check();
  expect(tracker.state.failure).toBe('snapshot');
  snapshot.mockReturnValue({ title: 'after failure' });
  tracker.check();
  expect(tracker.state.failure).toBeUndefined();
  expect(tracker.state.records).toEqual([]);
  snapshot.mockReturnValue({ title: 'untracked' });
  tracker.check();
  expect(tracker.state.records[0].changes).toEqual([{ op: 'replace', path: '/title' }]);
});

it('bounds history and paths, and clearing history preserves the comparison baseline', () => {
  const model = { schemaVersion: 42, title: 'original', tags: [] as string[] };
  const tracker = new DashboardEditIntegrityTracker(() => model);
  for (let i = 0; i < 101; i++) {
    model.title = String(i);
    tracker.check();
  }
  expect(tracker.state.records).toHaveLength(100);
  expect(tracker.state.droppedRecords).toBe(1);
  model.tags = Array.from({ length: 501 }, (_, i) => String(i));
  tracker.check();
  expect(tracker.state.records[99].changes).toHaveLength(500);
  expect(tracker.state.records[99].omittedPaths).toBe(1);
  tracker.clearHistory();
  tracker.check();
  expect(tracker.state.records).toEqual([]);
  expect(tracker.state.droppedRecords).toBe(0);
  model.title = 'new';
  tracker.check();
  expect(tracker.state.records[0].changes).toEqual([{ op: 'replace', path: '/title' }]);
});

it('marks a live edit registered by an unchanged action as potentially delayed and rebases it', () => {
  const model = { schemaVersion: 42, title: 'original' };
  const tracker = new DashboardEditIntegrityTracker(() => model);
  model.title = 'typed';
  tracker.run('Title blur', () => {
    model.title = 'typed';
  });
  tracker.check();
  expect(tracker.state.records).toEqual([
    expect.objectContaining({ kind: 'delayed', trigger: 'Title blur', changes: [{ op: 'replace', path: '/title' }] }),
  ]);
  tracker.run('undo', () => {
    model.title = 'original';
  });
  tracker.run('redo', () => {
    model.title = 'typed';
  });
  tracker.check();
  expect(tracker.state.records).toHaveLength(1);
});

it('keeps a preceding mismatch untracked when the action changes the saved model', () => {
  const model = { schemaVersion: 42, title: 'original', tags: [] as string[] };
  const tracker = new DashboardEditIntegrityTracker(() => model);
  model.title = 'outside';
  tracker.run('Add tag', () => {
    model.tags.push('tag');
  });
  expect(tracker.state.records[0]).toEqual(
    expect.objectContaining({ kind: 'untracked', changes: [{ op: 'replace', path: '/title' }] })
  );
});

it('does not reclassify earlier findings or known commits when an action leaves the model unchanged', () => {
  const model = { schemaVersion: 42, title: 'original' };
  const tracker = new DashboardEditIntegrityTracker(() => model);
  model.title = 'manual';
  tracker.check();
  tracker.run('No-op', () => {});
  model.title = 'committed';
  tracker.run('Commit', () => {}, 'committed');
  expect(tracker.state.records.map(({ kind }) => kind)).toEqual(['untracked', 'committed']);
});

it('does not classify failed actions or failed post-action snapshots as delayed', () => {
  const model = { schemaVersion: 42, title: 'original' };
  const snapshot = jest.fn(() => model);
  const tracker = new DashboardEditIntegrityTracker(snapshot);
  model.title = 'outside';
  expect(() =>
    tracker.run('Failed', () => {
      throw new Error('failed');
    })
  ).toThrow('failed');
  model.title = 'outside again';
  tracker.run('Snapshot fails', () => {
    snapshot.mockImplementationOnce(() => {
      throw new Error('snapshot failed');
    });
  });
  expect(tracker.state.records.map(({ kind }) => kind)).toEqual(['untracked', 'untracked']);
  expect(tracker.state.failure).toBe('snapshot');
});
