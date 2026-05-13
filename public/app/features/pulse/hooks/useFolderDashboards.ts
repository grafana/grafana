import { useEffect, useState } from 'react';

import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { type ResourceSuggestion } from '../utils/lookups';

interface State {
  items: ResourceSuggestion[];
  loading: boolean;
  error: string | null;
}

/**
 * useFolderDashboards fetches the direct child dashboards of a folder
 * for the composer's `#dashboard` mention picker. We deliberately keep
 * the scope to direct children (not the recursive descendant set) so
 * the picker mirrors what's visible on the folder page itself — if a
 * user can't see a dashboard in the folder browse view, they won't be
 * surprised to find it in the mention picker either.
 *
 * The Grafana searcher dedupes identical queries at the transport
 * layer, so two consumers of this hook on the same folder share a
 * single round-trip. The result list is bounded to 1000 dashboards
 * which is well above the practical folder size we expect; the picker
 * itself further trims to ten visible suggestions.
 */
export function useFolderDashboards(folderUID: string | undefined, enabled: boolean): State {
  const [state, setState] = useState<State>({ items: [], loading: false, error: null });

  useEffect(() => {
    if (!enabled || !folderUID) {
      setState({ items: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    getGrafanaSearcher()
      .search({
        kind: ['dashboard'],
        // `location` here is the parent folder uid the search backend
        // filters against. Empty / 'general' would return root-level
        // dashboards; we never call this for the root because the
        // folder Pulse tab is rendered per-folder.
        location: folderUID,
        query: '*',
        limit: 1000,
      })
      .then((result) => {
        if (cancelled) {
          return;
        }
        // result.view is a DataFrameView whose row shape is
        // DashboardQueryResult ({ uid, name, kind, ... }). We walk it
        // by index because DataFrameView doesn't expose a map/iterator
        // and reuses a single row object — copying out the fields is
        // the safe pattern.
        const items: ResourceSuggestion[] = [];
        for (let i = 0; i < result.view.length; i++) {
          const row = result.view.get(i);
          const uid = row?.uid ?? '';
          if (uid === '') {
            // Empty uids would produce a chip that can't link anywhere;
            // drop rather than render a broken mention. Should not
            // happen for real searcher output but the type allows it.
            continue;
          }
          items.push({ uid, title: row?.name ?? uid });
        }
        setState({ items, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        setState({ items: [], loading: false, error: message });
      });
    return () => {
      cancelled = true;
    };
  }, [folderUID, enabled]);

  return state;
}
