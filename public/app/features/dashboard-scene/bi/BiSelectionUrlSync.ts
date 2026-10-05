import {
  AdHocFiltersVariable,
  type AdHocFilterWithLabels,
  escapeUrlPipeDelimiters,
  sceneGraph,
  SceneObjectBase,
  type SceneObject,
  type SceneObjectState,
  SceneObjectStateChangedEvent,
  SceneObjectUrlSyncConfig,
  type SceneObjectUrlValues,
  VizPanel,
} from '@grafana/scenes';

import { getPanelSourceIdentity } from '../utils/getPanelSourceIdentity';

import {
  getValidBiSelection,
  hasBiSelectionMeta,
  isBiSelectable,
  stampBiSelection,
  stripBiSelectionStamp,
} from './biSelectionStamp';

/**
 * One value per selection, `<variable>|<key>|<owner panel>`, repeated like `var-Filters`. The filter values themselves
 * are already in `var-Filters`, so only ownership is stored.
 */
export const BI_SELECTION_URL_KEY = 'biSelection';

export interface BiSelectionOwner {
  /** Variable name, suffixed `-2`, `-3`... for later variables with the same name, like their URL keys */
  variable: string;
  key: string;
  sourcePanel: string;
}

export interface BiSelectionUrlSyncState extends SceneObjectState {
  /** Selection ownership as in the URL, including owners whose panel does not exist yet */
  owners: BiSelectionOwner[];
}

/**
 * Keeps BI selection ownership (`meta.biSelection` stamps) in the URL, so a refresh, back/forward or a shared link
 * shows the same selections. Owned by DashboardScene and only created while BI mode is on.
 *
 * A changed URL value is authoritative. Otherwise ownership follows the stamps, and an owner without a stamp is kept
 * and re-applied when its filter comes back without metadata (replaced from the URL) or when its panel appears (a
 * delayed repeat). It ends when its filter is removed, edited or released, which leave no or stale metadata.
 */
export class BiSelectionUrlSync extends SceneObjectBase<BiSelectionUrlSyncState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: [BI_SELECTION_URL_KEY] });

  private _reconciling = false;
  /** Whether the last reconcile kept owners whose variable or panel did not exist */
  private _hasUnresolvedOwners = false;

  public constructor(state: Partial<BiSelectionUrlSyncState> = {}) {
    super({ owners: [], ...state });

    this.addActivationHandler(() => {
      const sub = this.getRoot().subscribeToEvent(SceneObjectStateChangedEvent, ({ payload }) => {
        const { changedObject, partialUpdate } = payload;
        const filtersChanged = changedObject instanceof AdHocFiltersVariable && 'filters' in partialUpdate;
        if (filtersChanged || (this._hasUnresolvedOwners && addsSceneObjects(partialUpdate))) {
          this._reconcile();
        }
      });
      this._reconcile();
      return () => sub.unsubscribe();
    });
  }

  public getUrlState(): SceneObjectUrlValues {
    return { [BI_SELECTION_URL_KEY]: this.state.owners.map(encodeOwner) };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    const value = values[BI_SELECTION_URL_KEY];
    const encoded = value == null ? [] : Array.isArray(value) ? value : [value];
    const owners = encoded.map(decodeOwner).filter((owner) => owner !== undefined);

    this.setState({ owners });
    this._guarded(() => this._applyOwners(owners));
  }

  /** Makes the stamps match `owners` exactly: strips every other stamp and stamps owners whose panel exists. */
  private _applyOwners(owners: BiSelectionOwner[]) {
    for (const [id, variable] of getAdHocVariablesById(this.getRoot())) {
      const isOwner = (key: string, sourcePanel: string) =>
        owners.some((o) => o.variable === id && o.key === key && o.sourcePanel === sourcePanel);

      const next = variable.state.filters.map((filter) => {
        const stamp = getValidBiSelection(filter);
        return stamp && !isOwner(stamp.key, stamp.sourcePanel) ? stripBiSelectionStamp(filter) : filter;
      });

      for (const owner of owners) {
        if (owner.variable === id && this._panelExists(owner.sourcePanel)) {
          stampFirstSelectable(next, owner, () => true);
        }
      }

      updateIfChanged(variable, next);
    }
  }

  /** Follows the stamps, keeping and re-applying owners that have no stamp. */
  private _reconcile() {
    this._guarded(() => {
      const variables = getAdHocVariablesById(this.getRoot());
      const owners: BiSelectionOwner[] = [];
      let unresolved = false;

      for (const [id, variable] of variables) {
        const next = variable.state.filters.slice();

        for (const owner of this.state.owners) {
          if (owner.variable !== id || next.some((filter) => getValidBiSelection(filter)?.key === owner.key)) {
            continue;
          }
          const onKey = next.filter((filter) => filter.key === owner.key && isBiSelectable(filter));
          if (onKey.length === 0 || onKey.some(hasBiSelectionMeta)) {
            continue;
          }
          if (this._panelExists(owner.sourcePanel)) {
            stampFirstSelectable(next, owner, (filter) => !hasBiSelectionMeta(filter));
          } else {
            owners.push(owner);
            unresolved = true;
          }
        }

        updateIfChanged(variable, next);

        for (const filter of next) {
          const stamp = getValidBiSelection(filter);
          if (stamp && !owners.some((o) => o.variable === id && o.key === stamp.key)) {
            owners.push({ variable: id, key: stamp.key, sourcePanel: stamp.sourcePanel });
          }
        }
      }

      // Owners of a variable that does not exist (yet) are kept.
      const withoutVariable = this.state.owners.filter((o) => !variables.has(o.variable));
      owners.push(...withoutVariable);
      this._hasUnresolvedOwners = withoutVariable.length > 0 || unresolved;

      const ordered = sortLike(owners, this.state.owners);
      if (ordered.map(encodeOwner).join() !== this.state.owners.map(encodeOwner).join()) {
        this.setState({ owners: ordered });
      }
    });
  }

  private _panelExists(sourcePanel: string) {
    const isOwner = (obj: SceneObject) => obj instanceof VizPanel && getPanelSourceIdentity(obj) === sourcePanel;
    return Boolean(sceneGraph.findObject(this.getRoot(), isOwner));
  }

  // Stamping publishes filter changes, which would otherwise re-enter through the subscription.
  private _guarded(fn: () => void) {
    if (this._reconciling) {
      return;
    }
    this._reconciling = true;
    try {
      fn();
    } finally {
      this._reconciling = false;
    }
  }
}

function stampFirstSelectable(
  filters: AdHocFilterWithLabels[],
  owner: BiSelectionOwner,
  canStamp: (filter: AdHocFilterWithLabels) => boolean
) {
  const owned = filters.some((filter) => {
    const stamp = getValidBiSelection(filter);
    return stamp?.key === owner.key && stamp.sourcePanel === owner.sourcePanel;
  });
  const index = filters.findIndex((filter) => filter.key === owner.key && isBiSelectable(filter) && canStamp(filter));
  if (!owned && index >= 0) {
    filters[index] = stampBiSelection(filters[index], owner.sourcePanel);
  }
}

function updateIfChanged(variable: AdHocFiltersVariable, next: AdHocFilterWithLabels[]) {
  if (next.some((filter, i) => filter !== variable.state.filters[i])) {
    // The expression is unchanged but the excluded panel is not, so force the publish like selection writes do.
    variable.updateFilters(next, { forcePublish: true });
  }
}

/** Ad hoc variables by name; later same-named ones (by depth) get `-2`, `-3`... like Scenes' unique URL keys. */
function getAdHocVariablesById(root: SceneObject): Map<string, AdHocFiltersVariable> {
  const variables = sceneGraph
    .findAllObjects(root, (obj) => obj instanceof AdHocFiltersVariable)
    .filter((obj): obj is AdHocFiltersVariable => obj instanceof AdHocFiltersVariable)
    .map((variable, index) => ({ variable, index, depth: getDepth(variable) }))
    .sort((a, b) => a.depth - b.depth || a.index - b.index);

  const byId = new Map<string, AdHocFiltersVariable>();
  const seen = new Map<string, number>();
  for (const { variable } of variables) {
    const count = (seen.get(variable.state.name) ?? 0) + 1;
    seen.set(variable.state.name, count);
    byId.set(count > 1 ? `${variable.state.name}-${count}` : variable.state.name, variable);
  }
  return byId;
}

function getDepth(obj: SceneObject): number {
  let depth = 0;
  for (let current = obj.parent; current; current = current.parent) {
    depth++;
  }
  return depth;
}

/** Whether a state change sets scene objects, for example a layout adding repeated panels, rows or tabs. */
function addsSceneObjects(partialUpdate: object): boolean {
  return Object.values(partialUpdate).some(
    (value) =>
      value instanceof SceneObjectBase || (Array.isArray(value) && value.some((v) => v instanceof SceneObjectBase))
  );
}

/** Keeps owners in their previous URL order, so a re-stamp does not rewrite the URL. */
function sortLike(owners: BiSelectionOwner[], previous: BiSelectionOwner[]): BiSelectionOwner[] {
  const rank = (owner: BiSelectionOwner) => {
    const index = previous.findIndex((p) => p.variable === owner.variable && p.key === owner.key);
    return index < 0 ? previous.length : index;
  };
  return owners
    .map((owner, index) => ({ owner, index }))
    .sort((a, b) => rank(a.owner) - rank(b.owner) || a.index - b.index)
    .map(({ owner }) => owner);
}

// Same `__gfp__` escaping `var-Filters` uses for pipes, so names, keys and panel identities containing `|` round-trip.
function encodeOwner({ variable, key, sourcePanel }: BiSelectionOwner): string {
  return [variable, key, sourcePanel].map(escapeUrlPipeDelimiters).join('|');
}

function decodeOwner(value: string): BiSelectionOwner | undefined {
  const parts = value.split('|').map((part) => part.replace(/__gfp__/g, '|'));
  if (parts.length !== 3 || parts.some((part) => !part)) {
    return undefined;
  }

  const [variable, key, sourcePanel] = parts;
  return { variable, key, sourcePanel };
}
