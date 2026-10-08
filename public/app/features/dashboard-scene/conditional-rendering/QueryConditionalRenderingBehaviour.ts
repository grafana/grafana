import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { type SceneDataQuery, SceneObjectBase, type SceneObjectState, SceneQueryRunner } from '@grafana/scenes';
import { type PanelQueryKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { ConditionalRenderingGroup } from './group/ConditionalRenderingGroup';

export interface QueryConditionalRenderingBehaviourState extends SceneObjectState {
  /** refIds of the gated queries, index-aligned with `groups` */
  refIds: string[];
  groups: ConditionalRenderingGroup[];
  /** refIds of the queries hidden by this behaviour rather than by the dashboard author */
  conditionallyHidden: string[];
}

/**
 * Hides the queries of its parent `SceneQueryRunner` whose conditional rendering group evaluates to hidden, so they
 * are not sent to the data source, and re-runs the panel when a group result changes.
 *
 * Queries hidden by a condition keep their authored `hide` value in the save model: serializers read it through
 * `getAuthoredHide`.
 */
export class QueryConditionalRenderingBehaviour extends SceneObjectBase<QueryConditionalRenderingBehaviourState> {
  public constructor(state: Partial<QueryConditionalRenderingBehaviourState>) {
    super({ refIds: [], groups: [], conditionallyHidden: [], ...state });

    this.addActivationHandler(() => this._activationHandler());
  }

  /** Returns a behaviour for the queries that have a conditional rendering group, or undefined if none has one. */
  public static fromPanelQueries(queries: PanelQueryKind[]): QueryConditionalRenderingBehaviour | undefined {
    const refIds: string[] = [];
    const groups: ConditionalRenderingGroup[] = [];

    for (const query of queries) {
      if (query.spec.conditionalRendering) {
        refIds.push(query.spec.refId);
        groups.push(ConditionalRenderingGroup.deserialize(query.spec.conditionalRendering));
      }
    }

    return groups.length > 0 ? new QueryConditionalRenderingBehaviour({ refIds, groups }) : undefined;
  }

  public getGroup(refId: string): ConditionalRenderingGroup | undefined {
    const index = this.state.refIds.indexOf(refId);
    return index === -1 ? undefined : this.state.groups[index];
  }

  /** Returns the `hide` value of the query as authored, ignoring a hide applied by its condition. */
  public getAuthoredHide(query: SceneDataQuery): boolean {
    return Boolean(query.hide) && !this.state.conditionallyHidden.includes(query.refId);
  }

  private _activationHandler(): void {
    const queryRunner = this.parent;

    if (!(queryRunner instanceof SceneQueryRunner)) {
      throw new Error('QueryConditionalRenderingBehaviour must be attached to a SceneQueryRunner');
    }

    for (const group of this.state.groups) {
      if (!group.isActive) {
        this._subs.add(group.activate());
      }

      this._subs.add(
        group.subscribeToState((newState, prevState) => {
          if (newState.result !== prevState.result && this._applyConditions(queryRunner)) {
            queryRunner.runQueries();
          }
        })
      );
    }

    // A query unhidden from outside (e.g. in the query editor) is no longer hidden by its condition.
    this._subs.add(
      queryRunner.subscribeToState((newState, prevState) => {
        if (newState.queries === prevState.queries) {
          return;
        }

        const conditionallyHidden = this.state.conditionallyHidden.filter((refId) =>
          newState.queries.some((query) => query.refId === refId && query.hide)
        );

        if (conditionallyHidden.length !== this.state.conditionallyHidden.length) {
          this.setState({ conditionallyHidden });
        }
      })
    );

    // The runner reads its queries once its data source is resolved, so a first run started by its own activation
    // picks up these changes. A runner that already has data does not re-run on activation and needs a nudge.
    if (this._applyConditions(queryRunner) && queryRunner.state.data) {
      queryRunner.runQueries();
    }
  }

  /** Updates the `hide` flag of the gated queries from their group results; returns whether any query changed. */
  private _applyConditions(queryRunner: SceneQueryRunner): boolean {
    if (!getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaDashboardsQueryConditionalRendering, false)) {
      return false;
    }

    const conditionallyHidden = new Set(this.state.conditionallyHidden);
    let changed = false;

    const queries = queryRunner.state.queries.map((query) => {
      const group = this.getGroup(query.refId);

      if (!group) {
        return query;
      }

      if (!group.state.result && !query.hide) {
        conditionallyHidden.add(query.refId);
        changed = true;
        return { ...query, hide: true };
      }

      if (group.state.result && conditionallyHidden.has(query.refId)) {
        conditionallyHidden.delete(query.refId);
        changed = true;
        return { ...query, hide: false };
      }

      return query;
    });

    if (changed) {
      this.setState({ conditionallyHidden: [...conditionallyHidden] });
      queryRunner.setState({ queries });
    }

    return changed;
  }
}

export function getQueryConditionalRendering(
  queryRunner: SceneQueryRunner | undefined
): QueryConditionalRenderingBehaviour | undefined {
  return queryRunner?.state.$behaviors?.find(
    (behaviour): behaviour is QueryConditionalRenderingBehaviour =>
      behaviour instanceof QueryConditionalRenderingBehaviour
  );
}
