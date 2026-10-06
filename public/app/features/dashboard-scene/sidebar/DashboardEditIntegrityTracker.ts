import { compare } from 'fast-json-patch';
import { isEqual } from 'lodash';

import { SceneObjectBase, type SceneObjectState } from '@grafana/scenes';

import { type DashboardScene } from '../scene/DashboardScene';

export interface IntegrityChange {
  op: string;
  path: string;
}

export interface IntegrityRecord {
  id: number;
  timestamp: number;
  kind: 'untracked' | 'committed' | 'delayed';
  trigger: string;
  changes: IntegrityChange[];
  omittedPaths: number;
}

interface IntegrityState extends SceneObjectState {
  records: IntegrityRecord[];
  droppedRecords: number;
  failure?: string;
}

const MAX_RECORDS = 100;
const MAX_PATHS = 500;

/** Session diagnostics only; snapshots must never be included in scene clones or saved dashboards. */
export class DashboardEditIntegrityTracker extends SceneObjectBase<IntegrityState> {
  private baseline?: object;
  private depth = 0;
  private nextId = 0;

  constructor(private readonly snapshot: () => ReturnType<DashboardScene['getSaveModel']>) {
    super({ records: [], droppedRecords: 0 });
    this.accept();
  }

  private capture(): object | undefined {
    try {
      // Save models can retain references to scene state and contain non-JSON values.
      const snapshot = JSON.parse(JSON.stringify(this.snapshot()));
      this.setState({ failure: undefined });
      return snapshot;
    } catch {
      this.baseline = undefined;
      this.setState({ failure: 'snapshot' });
      return undefined;
    }
  }

  public accept() {
    this.baseline = this.capture();
  }

  public check(trigger = 'manual', kind: IntegrityRecord['kind'] = 'untracked') {
    if (this.depth) {
      return;
    }
    const current = this.capture();
    if (!current) {
      return;
    }
    let recordId: number | undefined;
    if (this.baseline) {
      const changes = compare(this.baseline, current).map(({ op, path }) => ({ op, path }));
      if (changes.length) {
        const records = this.state.records;
        recordId = ++this.nextId;
        this.setState({
          records: [
            ...records.slice(-(MAX_RECORDS - 1)),
            {
              id: recordId,
              timestamp: Date.now(),
              kind,
              trigger,
              changes: changes.slice(0, MAX_PATHS),
              omittedPaths: Math.max(0, changes.length - MAX_PATHS),
            },
          ],
          droppedRecords: this.state.droppedRecords + (records.length === MAX_RECORDS ? 1 : 0),
        });
      }
    }
    this.baseline = current;
    return recordId;
  }

  public run(trigger: string, operation: () => void, kind: IntegrityRecord['kind'] = 'untracked') {
    if (this.depth) {
      operation();
      return;
    }
    const recordId = this.check(trigger, kind);
    const before = this.baseline;
    let completed = false;
    this.depth++;
    try {
      operation();
      completed = true;
    } finally {
      this.depth--;
      // Even a partially failed action must not be attributed to the next action.
      this.accept();
      // Blur handlers may register an edit after its live preview has already updated the model.
      // An unchanged action is only a hint: it can also be an unrelated no-op.
      if (
        completed &&
        kind === 'untracked' &&
        recordId !== undefined &&
        before &&
        this.baseline &&
        isEqual(before, this.baseline)
      ) {
        this.setState({
          records: this.state.records.map((record) =>
            record.id === recordId ? { ...record, kind: 'delayed' } : record
          ),
        });
      }
    }
  }

  public clearHistory() {
    this.setState({ records: [], droppedRecords: 0 });
  }
}
