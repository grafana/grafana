import { type ComponentType } from 'react';
import { useAsync } from 'react-use';

import { locationService } from '@grafana/runtime';
import { PageLoader } from '@grafana/ui';

import { logError } from '../../Analytics';
import { type RuleKind } from '../shared/ruleKind';

import { loadDefaultSavedSearch, trackDefaultSavedSearchApplied } from './useRuleListSavedSearches';

/**
 * Mounts `Page` once the kind's default saved search is in the URL, so the page's first request already carries it.
 * Only a URL without a `search` parameter gets the default: an empty `search=` is a deliberate unfiltered list.
 */
export function withSavedSearchesSetup<P extends {}>(kind: RuleKind, Page: ComponentType<P>): ComponentType<P> {
  function SavedSearchesSetup(props: P) {
    const { loading } = useAsync(() => applyDefaultSavedSearch(kind), []);
    return loading ? <PageLoader /> : <Page {...props} />;
  }
  return SavedSearchesSetup;
}

/** Never rejects: without a default the page is still usable, and the toolbar control reports a failed load. */
async function applyDefaultSavedSearch(kind: RuleKind): Promise<void> {
  if (new URLSearchParams(locationService.getLocation().search).has('search')) {
    return;
  }
  try {
    const defaultSearch = await loadDefaultSavedSearch(kind);
    if (defaultSearch) {
      // Replacing keeps the bare URL out of the history, so Back never lands on an unfiltered list.
      locationService.partial({ search: defaultSearch.query }, true);
      trackDefaultSavedSearchApplied(kind);
    }
  } catch (error) {
    logError(error instanceof Error ? error : new Error('Failed to apply the default saved search'));
  }
}
