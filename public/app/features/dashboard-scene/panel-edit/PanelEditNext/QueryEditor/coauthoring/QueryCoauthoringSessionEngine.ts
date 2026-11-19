import { cloneDeep, isEqual } from 'lodash';

import { type DataQuery, type PanelData, generateUUID } from '@grafana/data';
import { sceneGraph, type SceneQueryRunner, type VizPanel } from '@grafana/scenes';

import { getQueryRunnerFor } from '../../../../utils/getQueryRunnerFor';

import { QueryCoauthoringRuns, type CoauthoringRunOption } from './QueryCoauthoringRuns';
import { prepareCoauthoringProposal } from './prepareCoauthoringProposal';
import {
  type QueryCoauthoringApplyResult,
  type QueryCoauthoringClosedReason,
  type QueryCoauthoringOption,
  type QueryCoauthoringRange,
  type QueryCoauthoringSession,
  type QueryCoauthoringStageResult,
  type QueryCoauthoringState,
} from './queryCoauthoringContracts';
import { classifyOptionOutcome, deriveQueryHealth } from './queryCoauthoringHealth';

/** Panel-edit scoped owner. The Surface supplies entry, selection and flag lifecycle signals. */
export class QueryCoauthoringSessionEngine {
  private static engines = new WeakMap<VizPanel, QueryCoauthoringSessionEngine>();

  public static get(panel: VizPanel): QueryCoauthoringSessionEngine | undefined {
    return this.engines.get(panel);
  }

  public static getOrCreate(panel: VizPanel): QueryCoauthoringSessionEngine {
    let engine = this.engines.get(panel);
    if (!engine) {
      engine = new QueryCoauthoringSessionEngine(panel);
      this.engines.set(panel, engine);
    }
    return engine;
  }

  private revision = 0;
  private session?: Session;
  private runner: SceneQueryRunner;
  private unsubscribe: () => void;
  private health: QueryCoauthoringState['health'];
  private internalCommit = false;

  public constructor(private panel: VizPanel) {
    const runner = getQueryRunnerFor(panel);
    if (!runner) {
      throw new Error('Query coauthoring requires a panel query runner');
    }
    this.runner = runner;
    this.health = deriveQueryHealth(runner.state.queries, runner.state.data);
    const subscription = runner.subscribeToState((state, previous) => {
      const changed = !isEqual(state.queries, previous.queries) || !isEqual(state.datasource, previous.datasource);
      if (changed) {
        this.revision++;
        this.health = Object.fromEntries(
          state.queries.map((query) => [query.refId, query.hide ? 'unknown' : (this.health[query.refId] ?? 'unknown')])
        );
        if (!this.internalCommit) {
          this.session?.canonicalChanged();
        }
      }
      if (state.data !== previous.data && !this.session?.ownsData(state.data)) {
        this.health = deriveQueryHealth(state.queries, state.data);
        this.session?.canonicalData(state.data);
      }
      if (changed || state.data !== previous.data) {
        this.session?.publish();
      }
    });
    this.unsubscribe = () => subscription.unsubscribe();
  }

  public enter(
    refId: string,
    ranges: QueryCoauthoringRange[] = [],
    select: (refId: string) => void = () => undefined
  ): QueryCoauthoringSession {
    if (!this.runner.state.queries.some((query) => query.refId === refId)) {
      throw new Error('Unknown query');
    }
    this.close('replaced');
    this.session = new Session(this, this.panel, this.runner, refId, ranges, select);
    return this.session;
  }

  public getRevision(): number {
    return this.revision;
  }

  public getHealth(): QueryCoauthoringState['health'] {
    return this.health;
  }

  public getEditorQueries(): DataQuery[] {
    return this.session?.editorQueries() ?? this.runner.state.queries;
  }

  /** An explicit Run invalidates a proposal even when the query text is unchanged. */
  public manualRun(): void {
    this.revision++;
    this.session?.manualRun();
    this.session?.publish();
  }

  public commit(queries: DataQuery[]): void {
    this.internalCommit = true;
    try {
      this.runner.setState({ queries: cloneDeep(queries) });
    } finally {
      this.internalCommit = false;
    }
    this.runner.runQueries();
  }

  public close(reason: QueryCoauthoringClosedReason): void {
    this.session?.close(reason);
    this.session = undefined;
  }

  public dispose(): void {
    this.close('left_panel_edit');
    this.unsubscribe();
    QueryCoauthoringSessionEngine.engines.delete(this.panel);
  }
}

class Session implements QueryCoauthoringSession {
  public readonly version = 1;
  private controller = new AbortController();
  public readonly signal = this.controller.signal;
  public readonly closed: Promise<QueryCoauthoringClosedReason>;
  private resolveClosed!: (reason: QueryCoauthoringClosedReason) => void;
  private listeners = new Set<(state: QueryCoauthoringState) => void>();
  private state: QueryCoauthoringState;
  private original: DataQuery[];
  private originalDatasource: SceneQueryRunner['state']['datasource'];
  private options: CoauthoringRunOption[] = [];
  private runs?: QueryCoauthoringRuns;
  private cache = new Map<string, PanelData>();
  private beforeAccept?: DataQuery[];
  private acceptedRevision?: number;
  private staging = 0;
  private stageController?: AbortController;
  private nextOption = 0;
  private rangeKey: string;
  private stopTime: () => void;

  public constructor(
    private owner: QueryCoauthoringSessionEngine,
    private panel: VizPanel,
    private runner: SceneQueryRunner,
    private focus: string,
    private ranges: QueryCoauthoringRange[],
    private selectQuery: (refId: string) => void
  ) {
    this.closed = new Promise((resolve) => {
      this.resolveClosed = resolve;
    });
    this.original = cloneDeep(runner.state.queries);
    this.originalDatasource = cloneDeep(runner.state.datasource);
    this.state = {
      sessionId: generateUUID(),
      revision: owner.getRevision(),
      step: 'review',
      queries: cloneDeep(this.original),
      health: cloneDeep(owner.getHealth()),
      proposal: null,
      previewedOption: 'original',
      canUndo: false,
      stale: false,
    };
    this.rangeKey = this.readRangeKey();
    const invalidate = () => {
      const key = this.readRangeKey();
      if (key !== this.rangeKey) {
        this.rangeKey = key;
        this.stopRuns();
        this.cache.clear();
        for (const option of this.state.proposal ?? []) {
          option.previewOutcome = 'loading';
          option.warnings = [];
          delete option.error;
        }
        if (
          !this.state.stale &&
          this.state.proposal &&
          (this.state.step === 'review' || this.state.previewedOption !== 'original')
        ) {
          this.restartRuns();
        } else {
          this.publish();
        }
      }
    };
    let stopRange = () => {};
    const subscribeRange = () => {
      stopRange();
      const subscription = sceneGraph.getTimeRange(panel).subscribeToState(invalidate);
      stopRange = () => subscription.unsubscribe();
    };
    subscribeRange();
    const panelSubscription = panel.subscribeToState((state, previous) => {
      if (state.$timeRange !== previous.$timeRange) {
        subscribeRange();
        invalidate();
      }
    });
    const runnerSubscription = runner.subscribeToState((state, previous) => {
      if (state.maxDataPoints !== previous.maxDataPoints || state.minInterval !== previous.minInterval) {
        invalidate();
      }
    });
    this.stopTime = () => {
      stopRange();
      panelSubscription.unsubscribe();
      runnerSubscription.unsubscribe();
    };
  }

  private readRangeKey(): string {
    const range = sceneGraph.getTimeRange(this.panel).state.value;
    return JSON.stringify([
      range.from.valueOf(),
      range.to.valueOf(),
      this.runner.state.maxDataPoints,
      this.runner.state.minInterval,
    ]);
  }

  public getState = (): QueryCoauthoringState => cloneDeep(this.state);

  public subscribe = (listener: (state: QueryCoauthoringState) => void): (() => void) => {
    if (!this.signal.aborted) {
      this.listeners.add(listener);
      listener(this.getState());
    }
    return () => {
      this.listeners.delete(listener);
    };
  };

  public publish(): void {
    if (this.signal.aborted) {
      return;
    }
    this.state.revision = this.owner.getRevision();
    this.state.queries = cloneDeep(this.runner.state.queries);
    this.state.health = cloneDeep(this.owner.getHealth());
    this.state.canUndo =
      this.state.step === 'apply' &&
      this.state.previewedOption === 'original' &&
      this.acceptedRevision === this.owner.getRevision();
    for (const listener of this.listeners) {
      listener(this.getState());
    }
  }

  public ownsData(data: PanelData | undefined): boolean {
    return this.runs?.ownsData(data) ?? false;
  }

  public canonicalData(data: PanelData | undefined): void {
    this.runs?.canonicalData(data);
  }

  public manualRun(): void {
    if (this.signal.aborted) {
      return;
    }
    if (this.state.step === 'apply' && this.acceptedRevision === this.owner.getRevision() - 1) {
      // Run advances revision without changing the accepted queries or their Undo snapshot.
      this.acceptedRevision = this.owner.getRevision();
      this.state.previewedOption = 'original';
      this.state.stale = true;
      this.stopRuns();
      this.cache.clear();
    } else {
      this.canonicalChanged();
    }
  }

  public canonicalChanged(): void {
    if (this.signal.aborted) {
      return;
    }
    if (!this.runner.state.queries.some((query) => query.refId === this.focus)) {
      this.close('focus_removed');
      return;
    }
    this.staging++;
    this.stageController?.abort();
    this.state.stale = true;
    this.state.step = 'review';
    this.state.previewedOption = 'original';
    this.stopRuns();
  }

  public editorQueries(): DataQuery[] {
    return cloneDeep(
      this.options.find((option) => option.id === this.state.previewedOption)?.queries ?? this.runner.state.queries
    );
  }

  public stageProposal = async (
    proposal: QueryCoauthoringOption[],
    { baseRevision, signal }: { baseRevision: number; signal?: AbortSignal }
  ): Promise<QueryCoauthoringStageResult[]> => {
    if (this.signal.aborted || signal?.aborted || baseRevision !== this.owner.getRevision()) {
      return proposal.map(() => ({ status: 'stale' }));
    }
    if (this.state.step !== 'review' || proposal.length > 3 || proposal.length === 0) {
      return proposal.map(() => ({ status: 'invalid' }));
    }
    this.stageController?.abort();
    const controller = new AbortController();
    this.stageController = controller;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    this.signal.addEventListener('abort', abort, { once: true });
    const generation = ++this.staging;
    const baseline = cloneDeep(this.runner.state.queries);
    const datasource = cloneDeep(this.runner.state.datasource);
    const { options: staged, results } = await prepareCoauthoringProposal({
      panel: this.panel,
      baseline,
      datasource,
      focus: this.focus,
      ranges: this.ranges,
      proposal,
      signal: controller.signal,
      nextId: () => `${this.state.sessionId}:${++this.nextOption}`,
    });
    signal?.removeEventListener('abort', abort);
    this.signal.removeEventListener('abort', abort);
    if (
      this.signal.aborted ||
      controller.signal.aborted ||
      generation !== this.staging ||
      baseRevision !== this.owner.getRevision()
    ) {
      return proposal.map(() => ({ status: 'stale' }));
    }
    this.stopRuns();
    this.original = baseline;
    this.originalDatasource = datasource;
    this.options = staged;
    this.state.proposal = results.flatMap((result) =>
      result.status === 'staged' ? [{ id: result.id, diffs: result.diffs, previewOutcome: null, warnings: [] }] : []
    );
    this.state.stale = false;
    this.state.previewedOption = 'original';
    this.publish();
    this.restartRuns(true);
    return cloneDeep(results);
  };

  private stopRuns(): void {
    // Keep the projection marker installed while restoring Original so health never reads a preview.
    this.runs?.dispose();
    this.runs = undefined;
  }

  private restartRuns(resetCache = false): void {
    this.stopRuns();
    if (resetCache) {
      this.cache.clear();
    }
    if (!this.options.length || this.signal.aborted) {
      return;
    }
    for (const option of this.state.proposal ?? []) {
      if (!this.cache.has(option.id)) {
        option.previewOutcome = 'loading';
        option.warnings = [];
        delete option.error;
      }
    }
    const runs = new QueryCoauthoringRuns(
      this.panel,
      this.runner,
      this.options,
      (id, data) => {
        if (this.runs !== runs || this.signal.aborted || this.state.stale) {
          return;
        }
        const option = this.state.proposal?.find((option) => option.id === id);
        const queries = this.options.find((option) => option.id === id)?.queries;
        if (option && queries) {
          const outcome = classifyOptionOutcome(
            data,
            queries,
            option.diffs.map((diff) => diff.refId)
          );
          option.previewOutcome = outcome.kind;
          option.warnings = outcome.warnings ?? [];
          option.error = outcome.kind === 'error' ? outcome.message : undefined;
          this.publish();
        }
      },
      this.cache
    );
    this.runs = runs;
    runs.select(this.state.previewedOption);
    runs.start();
    this.publish();
  }

  public preview = (optionId: string | 'original'): { ok: true } | { ok: false; reason: 'stale' } => {
    if (
      this.signal.aborted ||
      this.state.stale ||
      (optionId !== 'original' && !this.options.some((option) => option.id === optionId))
    ) {
      return { ok: false, reason: 'stale' };
    }
    this.state.previewedOption = optionId;
    if (!this.runs && optionId !== 'original') {
      this.restartRuns();
    } else {
      this.runs?.select(optionId);
    }
    this.publish();
    return { ok: true };
  };

  public accept = async (
    optionId: string,
    { baseRevision, signal }: { baseRevision: number; signal?: AbortSignal }
  ): Promise<QueryCoauthoringApplyResult> => {
    if (this.signal.aborted) {
      return { status: 'closed' };
    }
    if (signal?.aborted) {
      return { status: 'aborted' };
    }
    if (!navigator.userActivation?.isActive) {
      return { status: 'no_user_activation' };
    }
    if (
      this.state.stale ||
      baseRevision !== this.owner.getRevision() ||
      !isEqual(this.runner.state.queries, this.original) ||
      !isEqual(this.runner.state.datasource, this.originalDatasource)
    ) {
      return { status: 'stale' };
    }
    const option = this.options.find((option) => option.id === optionId);
    if (this.state.step !== 'review' || !option) {
      return { status: 'invalid' };
    }
    if (this.state.proposal?.find((option) => option.id === optionId)?.previewOutcome === 'error') {
      return { status: 'blocked' };
    }
    this.staging++;
    this.stageController?.abort();
    this.stopRuns();
    if (this.signal.aborted) {
      return { status: 'closed' };
    }
    if (signal?.aborted) {
      return { status: 'aborted' };
    }
    this.beforeAccept = cloneDeep(this.runner.state.queries);
    this.state.step = 'apply';
    this.state.previewedOption = 'original';
    this.owner.commit(option.queries);
    this.acceptedRevision = this.owner.getRevision();
    this.publish();
    return { status: 'applied', revision: this.owner.getRevision() };
  };

  public undo = async ({ signal }: { signal?: AbortSignal }): Promise<QueryCoauthoringApplyResult> => {
    if (this.signal.aborted) {
      return { status: 'closed' };
    }
    if (signal?.aborted) {
      return { status: 'aborted' };
    }
    if (!navigator.userActivation?.isActive) {
      return { status: 'no_user_activation' };
    }
    if (this.acceptedRevision !== undefined && this.acceptedRevision !== this.owner.getRevision()) {
      return { status: 'stale' };
    }
    if (this.state.step !== 'apply' || this.state.previewedOption !== 'original' || !this.beforeAccept) {
      return { status: 'invalid' };
    }
    this.stopRuns();
    this.owner.commit(this.beforeAccept);
    this.beforeAccept = undefined;
    this.acceptedRevision = undefined;
    this.state.step = 'review';
    this.state.stale = false;
    this.restartRuns();
    this.publish();
    return { status: 'applied', revision: this.owner.getRevision() };
  };

  public select = (refId: string): void => {
    if (!this.signal.aborted && this.runner.state.queries.some((query) => query.refId === refId)) {
      this.selectQuery(refId);
    }
  };

  public exit = (): void => this.close('exit');

  public close(reason: QueryCoauthoringClosedReason): void {
    if (this.signal.aborted) {
      return;
    }
    this.state.canUndo = false;
    this.controller.abort();
    this.staging++;
    this.stageController?.abort();
    this.stopTime();
    this.stopRuns();
    this.state.canUndo = false;
    this.state.previewedOption = 'original';
    this.listeners.clear();
    this.cache.clear();
    this.options = [];
    this.resolveClosed(reason);
  }
}
