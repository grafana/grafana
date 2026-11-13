import { type PanelData, LoadingState } from '@grafana/data';
import { type SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';

import { attachPreviewRunner, copyPanelData, createPreviewRunner, detachPreviewRunner } from './previewRunner';

export interface CoauthoringRunOption {
  id: string;
  queries: DataQuery[];
}

interface Run {
  runner: SceneQueryRunner;
  unsubscribe: () => void;
}

/** Owns hidden clones; only the selected option may project data into the canonical runner. */
export class QueryCoauthoringRuns {
  private runs = new Map<string, Run>();
  private started = new Set<string>();
  private selected = 'original';
  private disposed = false;
  private projected?: PanelData;
  private original?: PanelData;

  public constructor(
    private panel: VizPanel,
    private canonical: SceneQueryRunner,
    private options: CoauthoringRunOption[],
    private onData: (id: string, data: PanelData) => void,
    private cache = new Map<string, PanelData>()
  ) {
    this.original = canonical.state.data && copyPanelData(canonical.state.data);
    this.started = new Set(cache.keys());
  }

  public ownsData(data: PanelData | undefined): boolean {
    return data !== undefined && this.projected !== undefined && data.series === this.projected.series;
  }

  public canonicalData(data: PanelData | undefined): void {
    this.original = data && copyPanelData(data);
    const selected = this.cache.get(this.selected) ?? this.runs.get(this.selected)?.runner.state.data;
    if (selected) {
      this.project(selected);
    }
  }

  public start(): void {
    this.pump();
  }

  public select(id: string): void {
    this.selected = id;
    if (id === 'original') {
      this.restoreOriginal();
    } else {
      const data = this.cache.get(id) ?? this.runs.get(id)?.runner.state.data;
      if (data) {
        this.project(data);
      }
    }
    this.pump();
  }

  private project(data: PanelData): void {
    if (data.state === LoadingState.Loading && data.series.length === 0) {
      return;
    }
    this.projected = copyPanelData(data);
    this.canonical.setState({ data: this.projected });
  }

  private restoreOriginal(): void {
    this.projected = this.original && copyPanelData(this.original);
    this.canonical.setState({ data: this.projected });
  }

  private pump(): void {
    if (this.disposed) {
      return;
    }
    if (this.runs.size > 0) {
      return;
    }
    const selected = this.options.find((option) => option.id === this.selected && !this.started.has(option.id));
    const next = selected ?? this.options.find((option) => !this.started.has(option.id));
    if (next) {
      this.run(next);
    }
  }

  private run(option: CoauthoringRunOption): void {
    this.started.add(option.id);
    const runner = createPreviewRunner(this.canonical, option.queries);
    const run: Run = { runner, unsubscribe: () => undefined };
    this.runs.set(option.id, run);
    const subscription = runner.subscribeToState((state, previous) => {
      const data = state.data;
      if (this.disposed || this.runs.get(option.id) !== run || !data || data === previous.data) {
        return;
      }
      const finished = data.state === LoadingState.Done || data.state === LoadingState.Error;
      if (finished) {
        this.cache.set(option.id, copyPanelData(data));
      }
      if (this.selected === option.id) {
        this.project(data);
      }
      this.onData(option.id, data);
      if (finished && this.runs.get(option.id) === run) {
        this.detach(option.id, run);
        this.pump();
      }
    });
    run.unsubscribe = () => subscription.unsubscribe();
    attachPreviewRunner(this.panel, runner);
    runner.runQueries();
  }

  private detach(id: string, run: Run): void {
    this.runs.delete(id);
    run.unsubscribe();
    detachPreviewRunner(this.panel, run.runner);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const [id, run] of this.runs) {
      this.detach(id, run);
    }
    if (this.ownsData(this.canonical.state.data)) {
      this.restoreOriginal();
    }
  }
}
