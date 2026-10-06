import { FlagKeys } from '@grafana/runtime/internal';
import { StateCommittedEvent } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { startBatch, endBatch } from '../actions/utils/batch';
import { edit } from '../actions/utils/edit';
import { DashboardScene } from '../scene/DashboardScene';

let deactivate: (() => void) | undefined;
afterEach(() => {
  deactivate?.();
  setTestFlags({});
});

function setup(enabled = true, version: 'v1' | 'v2' = 'v1') {
  setTestFlags({ [FlagKeys.DashboardUndoRedoIntegrityCheck]: enabled });
  const dashboard = new DashboardScene({ title: 'initial', isEditing: true }, version);
  const sidebar = dashboard.state.sidebar;
  deactivate = sidebar.activate();
  return { dashboard, sidebar };
}

function rename(dashboard: DashboardScene, title: string) {
  const before = dashboard.state.title;
  edit({
    source: dashboard,
    description: 'Rename',
    perform: () => dashboard.setState({ title }),
    undo: () => dashboard.setState({ title: before }),
  });
}

it.each(['v1', 'v2'] as const)(
  'detects preceding untracked edits while accepting perform, undo, and redo (%s)',
  (version) => {
    const { dashboard, sidebar } = setup(true, version);
    dashboard.setState({ title: 'untracked' });
    rename(dashboard, 'tracked');
    sidebar.undoAction();
    expect(dashboard.state.title).toBe('untracked');
    sidebar.redoAction();
    expect(dashboard.state.title).toBe('tracked');
    sidebar.state.integrity!.check();
    expect(sidebar.state.integrity!.state.records).toEqual([
      expect.objectContaining({ kind: 'untracked', trigger: 'Rename', changes: [{ op: 'replace', path: '/title' }] }),
    ]);
  }
);

it('checks before undo and redo and rebases each mismatch', () => {
  const { dashboard, sidebar } = setup();
  rename(dashboard, 'tracked');
  dashboard.setState({ title: 'outside undo' });
  sidebar.undoAction();
  dashboard.setState({ title: 'outside redo' });
  sidebar.redoAction();
  sidebar.state.integrity!.check();
  expect(sidebar.state.integrity!.state.records.map(({ trigger }) => trigger)).toEqual([
    'undo: Rename',
    'redo: Rename',
  ]);
});

it('detects untracked edits between batch children without flagging composite replay', () => {
  const { dashboard, sidebar } = setup();
  startBatch(dashboard, 'batch');
  rename(dashboard, 'first');
  dashboard.setState({ title: 'untracked' });
  rename(dashboard, 'second');
  endBatch(dashboard);
  sidebar.undoAction();
  sidebar.redoAction();
  sidebar.state.integrity!.check();
  expect(dashboard.state.title).toBe('second');
  expect(sidebar.state.integrity!.state.records).toEqual([
    expect.objectContaining({ kind: 'untracked', changes: [{ op: 'replace', path: '/title' }] }),
  ]);
});

it('retains the uncertain interval for already-committed changes and accepts their replay', () => {
  const { dashboard, sidebar } = setup();
  dashboard.setState({ title: 'committed' });
  dashboard.publishEvent(
    new StateCommittedEvent({
      source: dashboard,
      description: 'Commit',
      replay: () => dashboard.setState({ title: 'committed' }),
      revert: () => dashboard.setState({ title: 'initial' }),
    }),
    true
  );
  sidebar.undoAction();
  sidebar.redoAction();
  sidebar.state.integrity!.check();
  expect(sidebar.state.integrity!.state.records).toEqual([
    expect.objectContaining({ kind: 'committed', changes: [{ op: 'replace', path: '/title' }] }),
  ]);
});

it('retains history across activation, excludes it from clones, and resets for a new session', () => {
  const { dashboard, sidebar } = setup();
  dashboard.setState({ title: 'untracked' });
  sidebar.state.integrity!.check();
  deactivate!();
  deactivate = sidebar.activate();
  expect(sidebar.state.integrity!.state.records).toHaveLength(1);
  expect(sidebar.clone({}).state.integrity).toBeUndefined();
  sidebar.resetIntegrity();
  sidebar.state.integrity!.check();
  expect(sidebar.state.integrity!.state.records).toEqual([]);
});

it('does not serialize dashboards when the flag is off', () => {
  const { dashboard, sidebar } = setup(false);
  const snapshot = jest.spyOn(dashboard, 'getSaveModel');
  rename(dashboard, 'tracked');
  sidebar.undoAction();
  sidebar.redoAction();
  expect(dashboard.state.title).toBe('tracked');
  expect(snapshot).not.toHaveBeenCalled();
  expect(sidebar.state.integrity).toBeUndefined();
});

it('initializes on entering edit mode without erasing diagnostics on repeated enters', () => {
  const { dashboard, sidebar } = setup();
  dashboard.setState({ isEditing: false, title: 'view change' });
  dashboard.onEnterEditMode();
  sidebar.state.integrity!.check();
  expect(sidebar.state.integrity!.state.records).toEqual([]);
  dashboard.setState({ title: 'untracked' });
  sidebar.state.integrity!.check();
  dashboard.onEnterEditMode();
  expect(sidebar.state.integrity!.state.records).toEqual([
    expect.objectContaining({ changes: [{ op: 'replace', path: '/title' }] }),
  ]);
});

it('preserves untracked edits at save while accepting the saved resource version', async () => {
  const { dashboard, sidebar } = setup();
  dashboard.setState({ title: 'untracked' });
  await dashboard.saveCompleted(dashboard.getSaveModel(), {
    uid: 'new-uid',
    slug: 'saved',
    url: '/d/new-uid/saved',
    version: 2,
    status: 'success',
  });
  sidebar.state.integrity!.check();
  expect(sidebar.state.integrity!.state.records).toEqual([
    expect.objectContaining({ trigger: 'save', changes: [{ op: 'replace', path: '/title' }] }),
  ]);
});
