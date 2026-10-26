import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { type SceneDataQuery, SceneObjectBase, type SceneObjectState, SceneQueryRunner } from '@grafana/scenes';
import {
  type ConditionalRenderingGroupSpec,
  type PanelQueryKind,
  type QueryConditionalRenderingGroupKind,
  type QueryConditionalRenderingGroupSpec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

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

  /** Returns the save model of the conditional rendering group of the query, or undefined if it has none. */
  public serializeGroup(refId: string): QueryConditionalRenderingGroupKind | undefined {
    const group = this.getGroup(refId)?.serialize();

    if (!group) {
      return undefined;
    }

    // Data conditions are not supported on queries, so they are never deserialized nor offered for a query group.
    return { kind: group.kind, spec: { ...group.spec, items: group.spec.items.filter(isQueryConditionItem) } };
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

    // Queries replaced from outside (query editor, undo) get their conditions re-applied synchronously, so the run
    // triggered by whoever replaced them already uses the right `hide` flags.
    this._subs.add(
      queryRunner.subscribeToState((newState, prevState) => {
        if (newState.queries !== prevState.queries) {
          this._applyConditions(queryRunner);
        }
      })
    );

    // The runner reads its queries once its data source is resolved, so a first run started by its own activation
    // picks up these changes. A runner that already has data does not re-run on activation and needs a nudge.
    if (this._applyConditions(queryRunner) && queryRunner.state.data) {
      queryRunner.runQueries();
    }
  }

  /**
   * Sets the `hide` flag of each gated query to its authored value, or to true while its group evaluates to hidden;
   * returns whether any query changed.
   */
  private _applyConditions(queryRunner: SceneQueryRunner): boolean {
    if (!getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaDashboardsQueryConditionalRendering, false)) {
      return false;
    }

    // refIds of queries currently absent from the runner are kept, so a query restored with the `hide` flag set by
    // its condition (e.g. by undo) is still recognized as conditionally hidden.
    const conditionallyHidden = new Set(this.state.conditionallyHidden);
    let queriesChanged = false;

    const queries = queryRunner.state.queries.map((query) => {
      const group = this.getGroup(query.refId);

      if (!group) {
        return query;
      }

      const authoredHide = Boolean(query.hide) && !conditionallyHidden.has(query.refId);
      const hide = authoredHide || !group.state.result;

      if (hide && !authoredHide) {
        conditionallyHidden.add(query.refId);
      } else {
        conditionallyHidden.delete(query.refId);
      }

      if (hide === Boolean(query.hide)) {
        return query;
      }

      queriesChanged = true;
      return { ...query, hide };
    });

    const previouslyHidden = this.state.conditionallyHidden;
    if (
      conditionallyHidden.size !== previouslyHidden.length ||
      previouslyHidden.some((refId) => !conditionallyHidden.has(refId))
    ) {
      this.setState({ conditionallyHidden: [...conditionallyHidden] });
    }

    if (queriesChanged) {
      queryRunner.setState({ queries });
    }

    return queriesChanged;
  }
}

function isQueryConditionItem(
  item: ConditionalRenderingGroupSpec['items'][number]
): item is QueryConditionalRenderingGroupSpec['items'][number] {
  return item.kind !== 'ConditionalRenderingData';
}

export function getQueryConditionalRendering(
  queryRunner: SceneQueryRunner | undefined
): QueryConditionalRenderingBehaviour | undefined {
  return queryRunner?.state.$behaviors?.find(
    (behaviour): behaviour is QueryConditionalRenderingBehaviour =>
      behaviour instanceof QueryConditionalRenderingBehaviour
  );
}
