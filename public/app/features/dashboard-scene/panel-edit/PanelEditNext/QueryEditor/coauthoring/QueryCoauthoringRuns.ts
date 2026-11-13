import { type PanelData, LoadingState } from '@grafana/data';
import { type SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';

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
    this.original = canonical.state.data && copyCoauthoringData(canonical.state.data);
    this.started = new Set(cache.keys());
  }

  public ownsData(data: PanelData | undefined): boolean {
    return data !== undefined && data === this.projected;
  }

  public canonicalData(data: PanelData | undefined): void {
    this.original = data && copyCoauthoringData(data);
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
    const data = id === 'original' ? this.original : (this.cache.get(id) ?? this.runs.get(id)?.runner.state.data);
    if (data) {
      this.project(data);
    }
    this.pump();
  }

  private project(data: PanelData): void {
    if (data.state === LoadingState.Loading && data.series.length === 0) {
      return;
    }
    this.projected = copyCoauthoringData(data);
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
    const runner = this.canonical.clone({
      key: undefined,
      queries: option.queries,
      data: undefined,
      _hasFetchedData: false,
      runQueriesMode: 'manual',
    });
    const run: Run = { runner, unsubscribe: () => undefined };
    this.runs.set(option.id, run);
    const subscription = runner.subscribeToState((state, previous) => {
      const data = state.data;
      if (this.disposed || this.runs.get(option.id) !== run || !data || data === previous.data) {
        return;
      }
      const finished = data.state === LoadingState.Done || data.state === LoadingState.Error;
      if (finished) {
        this.cache.set(option.id, copyCoauthoringData(data));
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
    this.panel.setState({ $behaviors: [...(this.panel.state.$behaviors ?? []), runner] });
    runner.runQueries();
  }

  private detach(id: string, run: Run): void {
    this.runs.delete(id);
    run.unsubscribe();
    run.runner.cancelQuery();
    // Pending datasource resolution must not issue a retired request after cancellation.
    run.runner.setState({ queries: [] });
    this.panel.setState({ $behaviors: this.panel.state.$behaviors?.filter((behavior) => behavior !== run.runner) });
    run.runner.clearParent();
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
      this.projected = this.original && copyCoauthoringData(this.original);
      this.canonical.setState({ data: this.projected });
    }
  }
}

export function copyCoauthoringData(data: PanelData): PanelData {
  const copyFrames = (frames: PanelData['series']): PanelData['series'] =>
    frames.map((frame) => ({
      ...frame,
      fields: frame.fields.map((field) => ({ ...field, values: field.values.slice() })),
    }));
  return { ...data, series: copyFrames(data.series), annotations: data.annotations && copyFrames(data.annotations) };
}
