import { useEffect } from 'react';
import { usePrevious } from 'react-use';

import { ActiveTab } from '../components/rule-viewer/RuleViewer';

import { useSyncedUrlDrawerParam } from './useSyncedUrlDrawerParam';

const ENRICHMENT_VIEW_PARAM = 'enrichment';
const ENRICHMENT_EDIT_PARAM = 'enrichment_edit';

/**
 * Manages the two enrichment URL params (`enrichment` and `enrichment_edit`) alongside
 * the active tab state for the rule viewer.
 *
 * - Deep-link: if either param is present on mount and no explicit tab is set, switches to
 *   the Enrichment tab automatically.
 * - Cleanup: clears both params when navigating away from the Enrichment tab so they do not
 *   linger on other tabs.
 */
export function useEnrichmentUrlParams({
  activeTab,
  setActiveTab,
}: {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}) {
  const view = useSyncedUrlDrawerParam(ENRICHMENT_VIEW_PARAM);
  const edit = useSyncedUrlDrawerParam(ENRICHMENT_EDIT_PARAM);

  // Deep-link: presence of either param (and no explicit tab in the URL) should open Enrichment.
  useEffect(() => {
    if ((view.value || edit.value) && activeTab !== ActiveTab.Enrichment) {
      setActiveTab(ActiveTab.Enrichment);
    }
    // Only run on mount / when the param values change, not on every tab change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.value, edit.value]);

  // Cleanup: drop both params when the user navigates away from the Enrichment tab.
  const previousTab = usePrevious(activeTab);
  useEffect(() => {
    if (previousTab === ActiveTab.Enrichment && activeTab !== ActiveTab.Enrichment) {
      view.setValue(null, true);
      edit.setValue(null, true);
    }
  }, [activeTab, previousTab, view, edit]);

  return { view, edit };
}
