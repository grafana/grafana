import { cloneDeep, isEqual } from 'lodash';

import { type DataQuery, type PanelData, generateUUID } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectStateChangedEvent,
  type SceneObject,
  type SceneQueryRunner,
  type VizPanel,
} from '@grafana/scenes';

import { isDashboardSceneLike } from '../../../../scene/types/dashboard';
import { CoauthoringQueriesAcceptedEvent } from '../../../../sidebar/events';
import { getQueryRunnerFor } from '../../../../utils/getQueryRunnerFor';

import { QueryCoauthoringRuns, type CoauthoringRunOption } from './QueryCoauthoringRuns';
import { prepareCoauthoringProposal } from './prepareCoauthoringProposal';
import { copyPanelData } from './previewRunner';
import {
  type CoauthoringResolverIdentity,
  resolveCoauthoringQuery,
  type ResolvedCoauthoringQuery,
  resolverInputs,
  reportCoauthoringError,
  sameResolverIdentity,
} from './queryCoauthoringContext';
import {
  type QueryCoauthoringEntryBaseline,
  type QueryCoauthoringContextResult,
  type QueryCoauthoringApplyResult,
  type QueryCoauthoringClosedReason,
  type QueryCoauthoringRange,
  type QueryCoauthoringSession,
  type QueryCoauthoringStageResult,
  type QueryCoauthoringState,
} from './queryCoauthoringContracts';
import { expressionReferences } from './queryCoauthoringDependencies';
import { classifyOptionOutcome, deriveQueryHealth } from './queryCoauthoringHealth';
import { classifyQueryResult } from './queryCoauthoringPreviewOutcome';
import { isQueryPreviewData, setQueryPreviewBlocked, stopQueryPreview } from './queryPreview';

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
  private contextGeneration = 0;
  private contextInputs: unknown;
  private resolverIdentities = new Map<string, CoauthoringResolverIdentity>();
  private canonicalPanelData?: PanelData;
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
    this.contextInputs = resolverInputs(panel, runner);
    // VizPanel releases previous field arrays when a preview replaces the rendered data.
    this.canonicalPanelData = runner.state.data && copyPanelData(runner.state.data);
    this.health = deriveQueryHealth(runner.state.queries, this.canonicalPanelData);
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
      if (
        state.data !== previous.data &&
        !this.session?.ownsData(state.data) &&
        !isQueryPreviewData(this.panel, state.data)
      ) {
        this.canonicalPanelData = state.data && copyPanelData(state.data);
        this.health = deriveQueryHealth(state.queries, this.canonicalPanelData);
        this.session?.canonicalData(this.canonicalPanelData);
      }
      if (changed || state.data !== previous.data) {
        this.session?.publish();
      }
    });
    let root: SceneObject = panel;
    while (root.parent) {
      root = root.parent;
    }
    const contextSubscription = root.subscribeToEvent(SceneObjectStateChangedEvent, () => {
      const previous = this.contextGeneration;
      this.getContextGeneration();
      if (previous !== this.contextGeneration) {
        this.session?.publish();
      }
    });
    this.unsubscribe = () => {
      subscription.unsubscribe();
      contextSubscription.unsubscribe();
    };
  }

  public enter(
    refId: string,
    ranges: QueryCoauthoringRange[] = [],
    select: (refId: string) => void = () => undefined,
    sessionId?: string,
    entry?: QueryCoauthoringEntryBaseline
  ): QueryCoauthoringSession {
    if (!this.runner.state.queries.some((query) => query.refId === refId)) {
      throw new Error('Unknown query');
    }
    this.close('replaced');
    this.session = new Session(this, this.panel, this.runner, refId, ranges, select, sessionId, entry);
    return this.session;
  }

  public setSurfaceActive(active: boolean): void {
    this.session?.setSurfaceActive(active);
  }

  public getRevision(): number {
    return this.revision;
  }

  public getContextGeneration(): number {
    const inputs = resolverInputs(this.panel, this.runner);
    if (!isEqual(inputs, this.contextInputs)) {
      this.contextInputs = inputs;
      this.contextGeneration++;
      this.resolverIdentities.clear();
    }
    return this.contextGeneration;
  }

  public observeResolver(refId: string, identity?: CoauthoringResolverIdentity): void {
    const previous = this.resolverIdentities.get(refId);
    if (!identity) {
      if (previous) {
        this.invalidateContext();
      }
      return;
    }
    if (previous && !sameResolverIdentity(previous, identity)) {
      this.invalidateContext();
    }
    this.resolverIdentities.set(refId, identity);
  }

  public invalidateContext(): void {
    this.resolverIdentities.clear();
    this.contextGeneration++;
    this.session?.publish();
  }

  public getCanonicalData(): PanelData | undefined {
    return this.canonicalPanelData;
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
    stopQueryPreview(this.panel);
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
  private surfaceActive = true;
  private stopTime: () => void;
  private stopHistory: () => void;
  private entry: QueryCoauthoringEntryBaseline;

  public constructor(
    private owner: QueryCoauthoringSessionEngine,
    private panel: VizPanel,
    private runner: SceneQueryRunner,
    private focus: string,
    ranges: QueryCoauthoringRange[],
    private selectQuery: (refId: string) => void,
    sessionId = generateUUID(),
    entry?: QueryCoauthoringEntryBaseline
  ) {
    this.entry = cloneDeep(
      entry ?? {
        refId: focus,
        revision: owner.getRevision(),
        contextGeneration: owner.getContextGeneration(),
        ranges,
        status: 'unavailable',
        reason: 'missing_language',
      }
    );
    const root = panel.getRoot();
    // History conflict protection must survive the Sidebar UI detaching during a live session.
    this.stopHistory = isDashboardSceneLike(root) ? root.state.sidebar.activate() : () => {};
    this.closed = new Promise((resolve) => {
      this.resolveClosed = resolve;
    });
    setQueryPreviewBlocked(panel, true);
    this.original = cloneDeep(runner.state.queries);
    this.originalDatasource = cloneDeep(runner.state.datasource);
    this.state = {
      sessionId,
      revision: owner.getRevision(),
      contextGeneration: owner.getContextGeneration(),
      dependencies: {},
      problems: [],
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

  private dependencies = () =>
    Object.fromEntries(
      this.runner.state.queries.map((query) => [
        query.refId,
        [
          ...new Set(expressionReferences({ ...query, datasource: query.datasource ?? this.runner.state.datasource })),
        ].filter((id) => this.runner.state.queries.some((query) => query.refId === id)),
      ])
    );

  public getState = (): QueryCoauthoringState => {
    const state = cloneDeep(this.state);
    const data = this.owner.getCanonicalData();
    const errors = [...(data?.errors ?? []), ...(data?.error ? [data.error] : [])];
    const unscoped = errors.filter((error) => !error.refId);
    const scopedData = data && { ...data, error: undefined, errors: errors.filter((error) => error.refId) };
    const health = deriveQueryHealth(state.queries, scopedData);
    const problems: QueryCoauthoringState['problems'] = unscoped.map((error) => ({
      scope: 'panel',
      kind: 'error',
      message: error.message?.slice(0, 500),
    }));
    for (const query of state.queries) {
      if (this.owner.getHealth()[query.refId] === 'unknown') {
        health[query.refId] = 'unknown';
      }
      if (unscoped.length && health[query.refId] === 'no-data') {
        health[query.refId] = 'unknown';
      }
      const kind = health[query.refId];
      if (kind === 'error' || kind === 'no-data') {
        const outcome = classifyQueryResult(scopedData, query.refId);
        problems.push({
          scope: 'query',
          refId: query.refId,
          kind,
          ...(outcome.kind === 'error' ? { message: outcome.message } : {}),
        });
      }
    }
    return {
      ...state,
      health,
      contextGeneration: this.owner.getContextGeneration(),
      dependencies: this.dependencies(),
      problems,
    };
  };

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
    if (!this.surfaceActive) {
      return cloneDeep(this.runner.state.queries);
    }
    return cloneDeep(
      this.options.find((option) => option.id === this.state.previewedOption)?.queries ?? this.runner.state.queries
    );
  }

  public getContext = async ({
    baseRevision,
    signal,
  }: {
    baseRevision: number;
    signal?: AbortSignal;
  }): Promise<QueryCoauthoringContextResult> => {
    const revision = this.owner.getRevision();
    const contextGeneration = this.owner.getContextGeneration();
    const stale = (): QueryCoauthoringContextResult => ({
      status: 'stale',
      currentRevision: this.owner.getRevision(),
      currentContextGeneration: this.owner.getContextGeneration(),
    });
    if (this.signal.aborted) {
      return { status: 'closed' };
    }
    if (signal?.aborted) {
      return { status: 'aborted' };
    }
    if (baseRevision !== revision) {
      return stale();
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    this.signal.addEventListener('abort', abort, { once: true });
    const queries = cloneDeep(this.runner.state.queries);
    const datasource = cloneDeep(this.runner.state.datasource);
    const deps = this.dependencies();
    const contexts = [];
    const validators: Array<{ refId: string; current(): Promise<boolean> }> = [];
    try {
      for (const query of queries) {
        if (this.signal.aborted) {
          return { status: 'closed' };
        }
        if (signal?.aborted) {
          return { status: 'aborted' };
        }
        if (revision !== this.owner.getRevision() || contextGeneration !== this.owner.getContextGeneration()) {
          return stale();
        }
        const resolved = await resolveCoauthoringQuery(this.panel, query, datasource, controller.signal);

        if (this.signal.aborted) {
          return { status: 'closed' };
        }
        if (signal?.aborted) {
          return { status: 'aborted' };
        }
        this.owner.observeResolver(query.refId, resolved.identity);
        try {
          const current = await resolved.current();
          if (this.signal.aborted) {
            return { status: 'closed' };
          }
          if (signal?.aborted) {
            return { status: 'aborted' };
          }
          if (!current) {
            this.owner.invalidateContext();
            return stale();
          }
        } catch (error) {
          reportCoauthoringError(error, controller.signal, 'context_validation');
          contexts.push({
            refId: query.refId,
            dependencies: deps[query.refId],
            editability: resolved.editability,
            description: { status: 'failed' as const, reason: 'datasource_resolution_failed' as const },
          });
          continue;
        }
        validators.push({ refId: query.refId, current: resolved.current });
        contexts.push({
          refId: query.refId,
          dependencies: deps[query.refId],
          editability: resolved.editability,
          description: resolved.description,
        });
      }
      for (const validator of validators) {
        try {
          const current = await validator.current();
          if (this.signal.aborted) {
            return { status: 'closed' };
          }
          if (signal?.aborted) {
            return { status: 'aborted' };
          }
          if (!current) {
            this.owner.invalidateContext();
            return stale();
          }
        } catch (error) {
          reportCoauthoringError(error, controller.signal, 'context_validation');
          const context = contexts.find((context) => context.refId === validator.refId)!;
          context.description = { status: 'failed', reason: 'datasource_resolution_failed' };
        }
      }
      if (this.signal.aborted) {
        return { status: 'closed' };
      }
      if (signal?.aborted) {
        return { status: 'aborted' };
      }
      if (revision !== this.owner.getRevision() || contextGeneration !== this.owner.getContextGeneration()) {
        return stale();
      }
      const focus = contexts.find((query) => query.refId === this.entry.refId)?.description;
      return {
        status: 'ready',
        sessionId: this.getState().sessionId,
        revision,
        contextGeneration,
        queries: contexts,
        entry: {
          ...cloneDeep(this.entry),
          matchesCurrentText:
            this.entry.status === 'ready' && focus?.status === 'ready'
              ? this.entry.text === focus.value.text
              : 'unknown',
        },
      };
    } finally {
      signal?.removeEventListener('abort', abort);
      this.signal.removeEventListener('abort', abort);
    }
  };

  public stageProposal: QueryCoauthoringSession['stageProposal'] = async (
    proposal,
    { baseRevision, baseContextGeneration, signal }
  ) => {
    const fence = (): QueryCoauthoringStageResult | undefined => {
      if (this.signal.aborted) {
        return { status: 'closed' };
      }
      if (signal?.aborted) {
        return { status: 'aborted' };
      }
      if (baseRevision !== this.owner.getRevision() || baseContextGeneration !== this.owner.getContextGeneration()) {
        return { status: 'stale' };
      }
      return undefined;
    };
    const rejected = fence();
    if (rejected) {
      return proposal.map(() => rejected);
    }
    if (this.state.step !== 'review' || !proposal.length || proposal.length > 3) {
      return proposal.map(() => ({ status: 'invalid', issue: { kind: 'invalid_change' } }));
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
    try {
      const sources: Array<{ refId: string; resolved: ResolvedCoauthoringQuery }> = [];
      for (const query of baseline) {
        const resolved = await resolveCoauthoringQuery(this.panel, query, datasource, controller.signal, false);
        if (controller.signal.aborted || generation !== this.staging) {
          return proposal.map((): QueryCoauthoringStageResult => fence() ?? { status: 'aborted' });
        }
        this.owner.observeResolver(query.refId, resolved.identity);
        sources.push({ refId: query.refId, resolved });
        const obsolete = fence();
        if (obsolete) {
          return proposal.map(() => obsolete);
        }
      }
      const { options, results } = await prepareCoauthoringProposal({
        panel: this.panel,
        baseline,
        datasource,
        focus: this.focus,
        entry: this.entry,
        proposal,
        signal: controller.signal,
        isCurrent: () => !controller.signal.aborted && !fence(),
        invalidateContext: () => {
          if (!controller.signal.aborted) {
            this.owner.invalidateContext();
          }
        },
        observeResolver: (refId, identity) => {
          if (!controller.signal.aborted) {
            this.owner.observeResolver(refId, identity);
          }
        },
        nextId: () => `${this.state.sessionId}:${++this.nextOption}`,
      });
      const stopped = fence();
      if (stopped) {
        return proposal.map(() => stopped);
      }
      if (controller.signal.aborted || generation !== this.staging) {
        return proposal.map(() => ({ status: 'aborted' }));
      }
      for (const { resolved } of sources) {
        try {
          const current = await resolved.current();
          if (controller.signal.aborted || generation !== this.staging) {
            return proposal.map((): QueryCoauthoringStageResult => fence() ?? { status: 'aborted' });
          }
          if (!current) {
            this.owner.invalidateContext();
            break;
          }
        } catch (error) {
          reportCoauthoringError(error, controller.signal, 'staging_validation');
          if (!controller.signal.aborted) {
            this.owner.invalidateContext();
          }
          break;
        }
      }
      const stale = fence();
      if (stale) {
        return proposal.map(() => stale);
      }
      if (generation !== this.staging || controller.signal.aborted) {
        return proposal.map(() => ({ status: 'aborted' }));
      }
      this.stopRuns();
      this.original = baseline;
      this.originalDatasource = datasource;
      this.options = options;
      this.state.proposal = results.flatMap((result) =>
        result.status === 'staged' ? [{ id: result.id, diffs: result.diffs, previewOutcome: null, warnings: [] }] : []
      );
      this.state.stale = false;
      this.state.previewedOption = 'original';
      this.publish();
      this.restartRuns(true);
      return cloneDeep(results);
    } finally {
      signal?.removeEventListener('abort', abort);
      this.signal.removeEventListener('abort', abort);
    }
  };

  public setSurfaceActive(active: boolean): void {
    if (this.signal.aborted || this.surfaceActive === active) {
      return;
    }
    this.surfaceActive = active;
    if (active) {
      setQueryPreviewBlocked(this.panel, true);
      if (!this.state.stale) {
        this.restartRuns();
      }
    } else {
      this.stopRuns();
      setQueryPreviewBlocked(this.panel, false);
    }
    this.publish();
  }

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
    if (!this.surfaceActive || !this.options.length || this.signal.aborted) {
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
    if (!this.surfaceActive) {
      this.publish();
      return { ok: true };
    }
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
    this.panel.publishEvent(new CoauthoringQueriesAcceptedEvent(), true);
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
    this.stopHistory();
    this.stopRuns();
    setQueryPreviewBlocked(this.panel, false);
    this.state.canUndo = false;
    this.state.previewedOption = 'original';
    this.listeners.clear();
    this.cache.clear();
    this.options = [];
    this.resolveClosed(reason);
  }
}
