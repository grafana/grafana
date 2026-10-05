import { isEqual } from 'lodash';

import {
  AdHocFiltersVariable,
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

import { getValidBiSelection, isBiSelectable, stampBiSelection, stripBiSelectionStamp } from './biSelectionStamp';

/**
 * One value per selection, `<key>|<owner panel>`, repeated like `var-Filters`. The filter values themselves are
 * already in `var-Filters`, so only ownership is stored.
 */
export const BI_SELECTION_URL_KEY = 'biSelection';

interface BiSelectionOwner {
  key: string;
  sourcePanel: string;
}

export interface BiSelectionUrlSyncState extends SceneObjectState {
  /** Encoded URL values, one per valid stamp in the dashboard's ad hoc filters */
  selections: string[];
}

/**
 * Keeps BI selection ownership (`meta.biSelection` stamps) in the URL, so a refresh, back/forward or a shared link
 * shows the same selections. Owned by DashboardScene and only created while BI mode is on.
 */
export class BiSelectionUrlSync extends SceneObjectBase<BiSelectionUrlSyncState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: [BI_SELECTION_URL_KEY] });

  /** Owners read from the URL, applied until the current URL sync pass has settled */
  private _pending: BiSelectionOwner[] | undefined;
  private _pendingUnsub: (() => void) | undefined;

  public constructor(state: Partial<BiSelectionUrlSyncState> = {}) {
    super({ selections: [], ...state });

    this.addActivationHandler(() => {
      const unsubscribe = subscribeToFilterChanges(this.getRoot(), () => this._onFiltersChanged());
      this._onFiltersChanged();
      return unsubscribe;
    });
  }

  public getUrlState(): SceneObjectUrlValues {
    return { [BI_SELECTION_URL_KEY]: this.state.selections };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    const value = values[BI_SELECTION_URL_KEY];
    const encoded = value == null ? [] : Array.isArray(value) ? value : [value];

    this._pending = encoded.map(decodeOwner).filter((owner) => owner !== undefined);
    this.setState({ selections: encoded });
    this._applyPending();

    // The Filters variable may apply `var-Filters` after this object in the same synchronous URL sync pass, or the
    // filters may change once more on load. Re-apply on those changes, then drop owners that could not be applied.
    if (!this._pendingUnsub) {
      this._pendingUnsub = subscribeToFilterChanges(this.getRoot(), () => this._applyPending());
      void Promise.resolve().then(() => this._settle());
    }
  }

  private _settle() {
    this._pendingUnsub?.();
    this._pendingUnsub = undefined;
    this._pending = undefined;
    this._syncSelectionsFromStamps();
  }

  private _onFiltersChanged() {
    if (this._pending) {
      this._applyPending();
      return;
    }
    this._syncSelectionsFromStamps();
  }

  /** Makes the stamps match the URL: stamps owners whose panel exists, turns every other stamp ordinary. */
  private _applyPending() {
    const pending = this._pending;
    if (!pending) {
      return;
    }

    const root = this.getRoot();
    const existing = (sourcePanel: string) =>
      Boolean(sceneGraph.findObject(root, (o) => o instanceof VizPanel && getPanelSourceIdentity(o) === sourcePanel));

    for (const variable of findAdHocVariables(root)) {
      const filters = variable.state.filters;
      const next = filters.map((filter) => {
        const owner = pending.find((o) => o.key === filter.key && existing(o.sourcePanel));
        const stamp = getValidBiSelection(filter);

        if (owner && isBiSelectable(filter)) {
          return stamp?.sourcePanel === owner.sourcePanel ? filter : stampBiSelection(filter, owner.sourcePanel);
        }
        return stamp ? stripBiSelectionStamp(filter) : filter;
      });

      if (next.some((filter, i) => filter !== filters[i])) {
        // The expression is unchanged but the excluded panel is not, so force the publish like selection writes do.
        variable.updateFilters(next, { forcePublish: true });
      }
    }
  }

  private _syncSelectionsFromStamps() {
    const selections: string[] = [];

    for (const variable of findAdHocVariables(this.getRoot())) {
      for (const filter of variable.state.filters) {
        const stamp = getValidBiSelection(filter);
        const encoded = stamp && encodeOwner({ key: stamp.key, sourcePanel: stamp.sourcePanel });
        if (encoded && !selections.includes(encoded)) {
          selections.push(encoded);
        }
      }
    }

    if (!isEqual(selections, this.state.selections)) {
      this.setState({ selections });
    }
  }
}

function findAdHocVariables(root: SceneObject): AdHocFiltersVariable[] {
  return sceneGraph
    .findAllObjects(root, (obj) => obj instanceof AdHocFiltersVariable)
    .filter((obj): obj is AdHocFiltersVariable => obj instanceof AdHocFiltersVariable);
}

function subscribeToFilterChanges(root: SceneObject, onChange: () => void): () => void {
  const sub = root.subscribeToEvent(SceneObjectStateChangedEvent, ({ payload }) => {
    if (payload.changedObject instanceof AdHocFiltersVariable && 'filters' in payload.partialUpdate) {
      onChange();
    }
  });
  return () => sub.unsubscribe();
}

// Same `__gfp__` escaping `var-Filters` uses for pipes, so keys and panel identities containing `|` round-trip.
function encodeOwner({ key, sourcePanel }: BiSelectionOwner): string {
  return `${escapeUrlPipeDelimiters(key)}|${escapeUrlPipeDelimiters(sourcePanel)}`;
}

function decodeOwner(value: string): BiSelectionOwner | undefined {
  const parts = value.split('|');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return undefined;
  }

  const [key, sourcePanel] = parts.map((part) => part.replace(/__gfp__/g, '|'));
  return { key, sourcePanel };
}
