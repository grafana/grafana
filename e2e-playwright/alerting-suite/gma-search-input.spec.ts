import { test, expect } from '@grafana/plugin-e2e';

import { RuleListPage, type RuleListKind, type SearchLeaf, filterLeaf } from './pages/RuleListPage';

// SEARCH-1: what the user types is a draft. Applying it writes the canonical query to the URL and
// sends the matching request, but the input keeps the text exactly as typed, with no reordering
// and no dropped tokens. No rules are seeded: the journey is about the input, not the results.
const journeys: Array<{
  kind: RuleListKind;
  typed: string;
  canonical: string;
  leaves: SearchLeaf[];
}> = [
  {
    kind: 'alert',
    typed: 'latency  state:firing label:team=payments   paused:false',
    canonical: 'label:team=payments paused:false state:firing latency',
    leaves: [
      { text: { value: 'latency' } },
      filterLeaf('state', 'In', ['Firing']),
      filterLeaf('labels', 'In', ['team=payments']),
      filterLeaf('paused', 'In', ['false']),
    ],
  },
  {
    kind: 'recording',
    typed: 'latency  health:ok metric:checkout_latency  label:team=payments',
    canonical: 'label:team=payments metric:checkout_latency health:ok latency',
    leaves: [
      { text: { value: 'latency' } },
      filterLeaf('health', 'In', ['Recording']),
      filterLeaf('metric', 'In', ['checkout_latency']),
      filterLeaf('labels', 'In', ['team=payments']),
    ],
  },
];

test.describe('Search input draft text', () => {
  for (const { kind, typed, canonical, leaves } of journeys) {
    test(`SEARCH-1 (${kind}): Enter applies a multi-token query and the input keeps the typed text`, async ({
      page,
    }) => {
      const list = new RuleListPage(page, kind);
      await list.goto();
      list.forgetRequests();

      await list.search(typed);

      for (const leaf of leaves) {
        await list.expectRequestLeaf(leaf);
      }
      await list.expectSearchParam(canonical);
      expect(new URL(page.url()).searchParams.get('search')).toBe(canonical);
      await expect(list.searchInput).toHaveValue(typed);
    });

    test(`SEARCH-1 (${kind}): typing applies a multi-token query after the debounce and the input keeps the typed text`, async ({
      page,
    }) => {
      const list = new RuleListPage(page, kind);
      await list.goto();
      list.forgetRequests();

      await list.searchInput.click();
      await list.searchInput.pressSequentially(typed, { delay: 15 });

      for (const leaf of leaves) {
        await list.expectRequestLeaf(leaf);
      }
      await list.expectSearchParam(canonical);
      await expect(list.searchInput).toHaveValue(typed);
    });
  }

  for (const kind of ['alert', 'recording'] as const) {
    test(`SEARCH-2 (${kind}): Clear filters empties the search input and the search in the URL`, async ({ page }) => {
      const list = new RuleListPage(page, kind);
      await list.goto('latency');
      await expect(list.searchInput).toHaveValue('latency');

      await list.clearFiltersButton.click();

      await expect(list.searchInput).toHaveValue('');
      await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBeNull();
    });
  }
});
