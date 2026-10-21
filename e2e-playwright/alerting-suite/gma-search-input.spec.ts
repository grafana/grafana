import { test, expect } from '@grafana/plugin-e2e';

import { RuleListPage, type RuleListKind, type SearchLeaf, filterLeaf } from './pages/RuleListPage';

// The input keeps text exactly as typed after applying.
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
    test(`${kind}: Enter applies a multi-token query and the input keeps the typed text`, async ({ page }) => {
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

    test(`${kind}: typing applies a multi-token query after the debounce and the input keeps the typed text`, async ({
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
    test(`${kind}: Clear filters empties the search input and the search in the URL`, async ({ page }) => {
      const list = new RuleListPage(page, kind);
      await list.goto('latency');
      await expect(list.searchInput).toHaveValue('latency');

      await list.clearFiltersButton.click();

      await expect(list.searchInput).toHaveValue('');
      // An empty search, not a missing one, so a reload doesn't reapply the default saved search.
      await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe('');
    });
  }
});
