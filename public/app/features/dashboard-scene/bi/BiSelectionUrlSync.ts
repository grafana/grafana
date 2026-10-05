import { type Unsubscribable } from 'rxjs';

import { locationService } from '@grafana/runtime';
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
  isStaleBiSelection,
  releaseBiSelectionStamp,
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
      // Each ad hoc variable is watched directly rather than through the root, so the handler runs before the
      // UrlSyncManager (which listens on the root) writes a local change to the URL. See isRestoredFromUrl.
      const variableSubs = new Map<AdHocFiltersVariable, Unsubscribable>();
      const watchVariables = () => {
        const current = new Set(getAdHocVariablesById(this.getRoot()).values());
        for (const [variable, sub] of variableSubs) {
          if (!current.has(variable)) {
            sub.unsubscribe();
            variableSubs.delete(variable);
          }
        }
        for (const variable of current) {
          if (!variableSubs.has(variable)) {
            variableSubs.set(
              variable,
              variable.subscribeToState((next, prev) => {
                if (next.filters !== prev.filters) {
                  this._reconcile({ variable, prev: prev.filters, fromUrl: this._isRestoredFromUrl(variable) });
                }
              })
            );
          }
        }
      };

      const rootSub = this.getRoot().subscribeToEvent(SceneObjectStateChangedEvent, ({ payload }) => {
        if (addsSceneObjects(payload.partialUpdate)) {
          watchVariables();
          if (this._hasUnresolvedOwners) {
            this._reconcile();
          }
        }
      });

      watchVariables();
      this._reconcile();
      return () => {
        rootSub.unsubscribe();
        variableSubs.forEach((sub) => sub.unsubscribe());
        variableSubs.clear();
      };
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

  /**
   * Makes the stamps match `owners` exactly for variables whose filters already match the URL: strips every other
   * stamp and stamps owners whose panel exists.
   */
  private _applyOwners(owners: BiSelectionOwner[]) {
    for (const [id, variable] of getAdHocVariablesById(this.getRoot())) {
      // The URL does not encode this variable's filters yet, so its URL handler replaces them later in this URL pass
      // and the reconcile on that change stamps them. Writing now would make the UrlSyncManager put the outgoing
      // filters back into the destination URL in the middle of the pass.
      if (!this._isRestoredFromUrl(variable)) {
        continue;
      }

      const isOwner = (key: string, sourcePanel: string) =>
        owners.some((o) => o.variable === id && o.key === key && o.sourcePanel === sourcePanel);

      const next = variable.state.filters.map((filter) => {
        const stamp = getValidBiSelection(filter);
        return stamp && !isOwner(stamp.key, stamp.sourcePanel) ? stripBiSelectionStamp(filter) : filter;
      });

      for (const owner of owners) {
        if (owner.variable === id && this._panelExists(owner.sourcePanel)) {
          stampFirstSelectable(next, owner);
        }
      }

      updateIfChanged(variable, next);
    }

    this._hasUnresolvedOwners = owners.some(
      (owner) => !getAdHocVariablesById(this.getRoot()).has(owner.variable) || !this._panelExists(owner.sourcePanel)
    );
  }

  /**
   * Follows the stamps, keeping and re-applying owners that have no stamp.
   *
   * Without `change` (activation, or a delayed panel appearing) an owner is applied to its key's filter when that has no
   * BI metadata. With `change` (a variable's filters changed), an owner whose key's filters changed is re-applied only
   * when the variable's URL handler replaced them (new filter objects without metadata); any local edit, removal or
   * release of that key ends the selection, even while its panel does not exist yet.
   *
   * A stamp invalidated by an edit is replaced with the release marker, so editing the value or key back cannot make
   * it valid again.
   */
  private _reconcile(change?: { variable: AdHocFiltersVariable; prev: AdHocFilterWithLabels[]; fromUrl: boolean }) {
    this._guarded(() => {
      const variables = getAdHocVariablesById(this.getRoot());
      const owners: BiSelectionOwner[] = [];

      for (const [id, variable] of variables) {
        const next = variable.state.filters.map((filter) =>
          isStaleBiSelection(filter) ? releaseBiSelectionStamp(filter) : filter
        );
        const released = next.some((filter, i) => filter !== variable.state.filters[i]);
        const prev = change?.variable === variable ? change.prev : undefined;
        const fromUrl = change?.variable === variable && change.fromUrl;

        let stamped = false;
        for (const owner of this.state.owners) {
          if (owner.variable !== id || next.some((filter) => getValidBiSelection(filter)?.key === owner.key)) {
            continue;
          }
          if (prev && !keyFiltersChanged(prev, next, owner.key)) {
            owners.push(owner);
            continue;
          }

          const onKey = next.filter((filter) => filter.key === owner.key && isBiSelectable(filter));
          const candidates = !prev
            ? onKey.some(hasBiSelectionMeta)
              ? []
              : onKey
            : fromUrl
              ? onKey.filter((filter) => !prev.includes(filter) && !hasBiSelectionMeta(filter))
              : [];
          if (candidates.length === 0) {
            // Removed, edited or released: the selection ends
            continue;
          }

          if (this._panelExists(owner.sourcePanel)) {
            next[next.indexOf(candidates[0])] = stampBiSelection(candidates[0], owner.sourcePanel);
            stamped = true;
          } else {
            owners.push(owner);
          }
        }

        // Releasing stale stamps alone changes no panel's filters, so it does not re-run queries.
        if (stamped || released) {
          variable.updateFilters(next, stamped ? { forcePublish: true } : { skipPublish: true });
        }

        for (const filter of next) {
          const stamp = getValidBiSelection(filter);
          if (stamp && !owners.some((o) => o.variable === id && o.key === stamp.key)) {
            owners.push({ variable: id, key: stamp.key, sourcePanel: stamp.sourcePanel });
          }
        }
      }

      // Owners of a variable that does not exist (yet) are kept.
      owners.push(...this.state.owners.filter((o) => !variables.has(o.variable)));
      this._hasUnresolvedOwners = owners.some((owner) => {
        const filters = variables.get(owner.variable)?.state.filters ?? [];
        return !filters.some((filter) => {
          const stamp = getValidBiSelection(filter);
          return stamp?.key === owner.key && stamp.sourcePanel === owner.sourcePanel;
        });
      });

      const ordered = sortLike(owners, this.state.owners);
      if (ordered.map(encodeOwner).join() !== this.state.owners.map(encodeOwner).join()) {
        this.setState({ owners: ordered });
      }
    });
  }

  /**
   * Whether a variable's new filters came from the URL: the current URL already encodes exactly them. URL restoration
   * changes the URL first and then the variable; a local edit (pills, Filters Overview, updateFilters) changes the
   * variable first, and this runs before the UrlSyncManager writes it to the URL.
   */
  private _isRestoredFromUrl(variable: AdHocFiltersVariable): boolean {
    const id = [...getAdHocVariablesById(this.getRoot())].find(([, v]) => v === variable)?.[0];
    const urlSync = variable.urlSync;
    if (!id || !urlSync) {
      return false;
    }

    const [key] = urlSync.getKeys();
    const own = urlSync.getUrlState()[key];
    const encoded = (own == null ? [] : Array.isArray(own) ? own : [own]).filter((value) => value !== '');
    const inUrl = new URLSearchParams(locationService.getLocation().search)
      .getAll(`var-${id}`)
      .filter((value) => value !== '');

    return encoded.length === inUrl.length && encoded.every((value, i) => value === inUrl[i]);
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

function stampFirstSelectable(filters: AdHocFilterWithLabels[], owner: BiSelectionOwner) {
  const owned = filters.some((filter) => {
    const stamp = getValidBiSelection(filter);
    return stamp?.key === owner.key && stamp.sourcePanel === owner.sourcePanel;
  });
  const index = filters.findIndex((filter) => filter.key === owner.key && isBiSelectable(filter));
  if (!owned && index >= 0) {
    filters[index] = stampBiSelection(filters[index], owner.sourcePanel);
  }
}

function keyFiltersChanged(prev: AdHocFilterWithLabels[], next: AdHocFilterWithLabels[], key: string): boolean {
  const before = prev.filter((filter) => filter.key === key);
  const after = next.filter((filter) => filter.key === key);
  return before.length !== after.length || before.some((filter, i) => filter !== after[i]);
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
