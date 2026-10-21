# Recording Rules Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal GMA Recording rules list page at `/alerting/rules/recording` that mirrors the Alert rules page built in PR #135568.

**Architecture:** Direct mirror of `alert-rules/` into a new `recording-rules/` directory. No new abstractions — shared components (`RuleStatusIcon`, `ResultCount`, `mocks/handlers`) already support `kind: 'recording'`. TDD throughout: write the failing test, verify it fails, implement, verify it passes, commit.

**Tech Stack:** React, TypeScript, RTK Query (infinite query), MSW (test mocking), Jest + React Testing Library

---

All new files live under:
`public/app/features/alerting/unified/gma-rule-list/recording-rules/`

Referenced shared paths (read-only, do not modify):

- `gma-rule-list/rule-search/searchHitFields.ts` — `asString`, `asBoolean`, `asOneOf`
- `gma-rule-list/shared/keysOf.ts` — `keysOf`
- `gma-rule-list/shared/pagedQuery.ts` — `PagedResult`, `keepFirstPage`, `usePagedResult`
- `gma-rule-list/rule-row/ResultCount.tsx` — `ResultCount`, `ResultTotal`, `toResultTotal`
- `gma-rule-list/rule-row/RuleStatusIcon.tsx` — `RuleStatusIcon`
- `gma-rule-list/rule-row/FolderPath.tsx` — `FolderPath`
- `gma-rule-list/rule-row/RuleListItem.tsx` — `RuleListItem`
- `gma-rule-list/rule-row/RuleListSkeleton.tsx` — `RuleListSkeleton`
- `gma-rule-list/rule-row/RuleRowList.tsx` — `RuleRowList`
- `gma-rule-list/folder-browsing/folderLookups.ts` — `useFolderPath`
- `gma-rule-list/shared/InlineRequestError.tsx` — `InlineRequestError`
- `gma-rule-list/shared/LoadMoreFooter.tsx` — `LoadMoreFooter`
- `gma-rule-list/shared/analytics.ts` — `useTrackRuleListPageView`
- `gma-rule-list/mocks/factories.ts` — `ruleItem`
- `gma-rule-list/mocks/handlers.ts` — `mockRuleSearch`, `mockFolderParents`, `ruleSearchUrl`
- `unified/utils/navigation.ts` — `grafanaRulesNav`
- `unified/components/AlertingPageWrapper.tsx` — `AlertingPageWrapper`
- `unified/withPageErrorBoundary.tsx` — `withPageErrorBoundary`
- `unified/mockApi.ts` — `setupMswServer`

Generated API types (from `@grafana/api-clients/rtkq/rules.alerting/v0alpha1`):

- `ListRecordingRuleSearchRulesV0Alpha1ApiResponse`
- `ListRecordingRuleSearchRulesV0Alpha1SearchResultHit`
- `ListRecordingRuleSearchRulesV0Alpha1RequestBody`
- `RecordingRuleRecordingRuleHealth` = `'Unknown' | 'Recording' | 'Paused' | 'Error' | 'NoData'`
- `generatedAPI` (the RTK Query base API)

---

### Task 1: Search hit mapper

**Files:**

- Create: `gma-rule-list/recording-rules/recordingRuleSearchHit.ts`
- Create: `gma-rule-list/recording-rules/recordingRuleSearchHit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `recordingRuleSearchHit.test.ts`:

```ts
import { toRecordingRuleSearchHit } from './recordingRuleSearchHit';

function toHit(fields?: Record<string, unknown>) {
  return toRecordingRuleSearchHit({
    resource: {
      group: 'rules.alerting.grafana.app',
      kind: 'RecordingRule',
      resource: 'recordingrules',
      name: 'rule-1',
    },
    fields,
  });
}

describe('toRecordingRuleSearchHit', () => {
  it('reads the row fields from the search hit', () => {
    const hit = toHit({ title: 'cpu:usage:rate5m', folder: 'folder-1', paused: true, health: 'Recording' });

    expect(hit).toEqual({
      uid: 'rule-1',
      title: 'cpu:usage:rate5m',
      folderUid: 'folder-1',
      paused: true,
      health: 'Recording',
    });
  });

  it('falls back to the rule UID for the title and leaves fields of the wrong type unset', () => {
    const hit = toHit({ title: 42, folder: ['folder-1'], paused: 'true' });

    expect(hit).toEqual({
      uid: 'rule-1',
      title: 'rule-1',
      folderUid: undefined,
      paused: undefined,
      health: undefined,
    });
  });

  it('leaves status unset when the search returned no fields', () => {
    expect(toHit()).toEqual({ uid: 'rule-1', title: 'rule-1' });
  });

  it.each([
    { name: 'wrong case', health: 'recording' },
    { name: 'an unknown value', health: 'Degraded' },
    { name: 'an Alert rule health value', health: 'OK' },
  ])('leaves health unset for $name', ({ health }) => {
    expect(toHit({ health }).health).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchHit.test.ts
```

Expected: FAIL — `Cannot find module './recordingRuleSearchHit'`

- [ ] **Step 3: Implement the mapper**

Create `recordingRuleSearchHit.ts`:

```ts
import {
  type ListRecordingRuleSearchRulesV0Alpha1SearchResultHit,
  type RecordingRuleRecordingRuleHealth,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { asBoolean, asOneOf, asString } from '../rule-search/searchHitFields';
import { keysOf } from '../shared/keysOf';

export interface RecordingRuleSearchHit {
  uid: string;
  title: string;
  folderUid?: string;
  paused?: boolean;
  /** Absent until `alerting.ruleStatusSync` populates it; absence reads as Unavailable. */
  health?: RecordingRuleRecordingRuleHealth;
}

export function toRecordingRuleSearchHit(
  item: ListRecordingRuleSearchRulesV0Alpha1SearchResultHit
): RecordingRuleSearchHit {
  const fields: Record<string, unknown> = item.fields ?? {};

  return {
    uid: item.resource.name,
    title: asString(fields.title) ?? item.resource.name,
    folderUid: asString(fields.folder),
    paused: asBoolean(fields.paused),
    health: asOneOf(fields.health, RECORDING_RULE_HEALTHS),
  };
}

// Keyed by the generated union, so a value the API adds or drops fails the type check here.
const RECORDING_RULE_HEALTHS = keysOf<RecordingRuleRecordingRuleHealth>({
  Unknown: true,
  Recording: true,
  Paused: true,
  Error: true,
  NoData: true,
});
```

- [ ] **Step 4: Run test to verify it passes**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchHit.test.ts
```

Expected: PASS — 6 tests pass

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchHit.ts \
        public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchHit.test.ts
git commit -m "feat(alerting): add RecordingRule search hit mapper"
```

---

### Task 2: Search query builder

**Files:**

- Create: `gma-rule-list/recording-rules/recordingRuleSearchQuery.ts`
- Create: `gma-rule-list/recording-rules/recordingRuleSearchQuery.test.ts`

- [ ] **Step 1: Write the failing test**

Create `recordingRuleSearchQuery.test.ts`:

```ts
import { buildRecordingRuleSearchQuery } from './recordingRuleSearchQuery';

describe('buildRecordingRuleSearchQuery', () => {
  it('asks for the first 40 rules by title with the fields the row shows, without a state field', () => {
    expect(buildRecordingRuleSearchQuery()).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      sort: [{ field: 'title', direction: 'asc' }],
      fields: ['title', 'folder', 'paused', 'health'],
      limit: 40,
    });
  });

  it('passes the continuation token through', () => {
    expect(buildRecordingRuleSearchQuery('opaque-token').continue).toBe('opaque-token');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchQuery.test.ts
```

Expected: FAIL — `Cannot find module './recordingRuleSearchQuery'`

- [ ] **Step 3: Implement the query builder**

Create `recordingRuleSearchQuery.ts`:

```ts
import { type ListRecordingRuleSearchRulesV0Alpha1RequestBody } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

export function buildRecordingRuleSearchQuery(continueToken?: string) {
  return {
    apiVersion: 'search.grafana.app/v0alpha1',
    kind: 'SearchQuery',
    sort: [{ field: 'title', direction: 'asc' }],
    fields: RECORDING_RULE_FIELDS,
    limit: DEFAULT_PER_PAGE_PAGINATION,
    ...(continueToken ? { continue: continueToken } : {}),
  } satisfies ListRecordingRuleSearchRulesV0Alpha1RequestBody;
}

// `health` is the only status field: recording rules have no alert state.
const RECORDING_RULE_FIELDS = ['title', 'folder', 'paused', 'health'];
```

- [ ] **Step 4: Run test to verify it passes**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchQuery.test.ts
```

Expected: PASS — 2 tests pass

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchQuery.ts \
        public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchQuery.test.ts
git commit -m "feat(alerting): add RecordingRule search query builder"
```

---

### Task 3: Infinite search hook

**Files:**

- Create: `gma-rule-list/recording-rules/recordingRuleSearch.ts`

No separate unit test — this is an RTK Query wrapper integration-tested via the page tests in Task 7.

- [ ] **Step 1: Implement the search hook**

Create `recordingRuleSearch.ts`:

```ts
import {
  type ListRecordingRuleSearchRulesV0Alpha1ApiResponse,
  generatedAPI,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useDispatch } from 'app/types/store';

import { type ResultTotal, toResultTotal } from '../rule-row/ResultCount';
import { type PagedResult, keepFirstPage, usePagedResult } from '../shared/pagedQuery';

import { type RecordingRuleSearchHit, toRecordingRuleSearchHit } from './recordingRuleSearchHit';
import { buildRecordingRuleSearchQuery } from './recordingRuleSearchQuery';

interface RecordingRuleSearchPage {
  hits: RecordingRuleSearchHit[];
  continueToken?: string;
  total?: ResultTotal;
}

/** Infinite query; the generated search is a POST mutation with no tags or page state. */
const recordingRuleSearchAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    searchRecordingRules: build.infiniteQuery<RecordingRuleSearchPage, void, string | undefined>({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.continueToken || undefined,
      },
      // Results are a view of the current page only: leaving it drops them, and coming back searches again.
      keepUnusedDataFor: 0,
      query: ({ pageParam }) => ({
        url: '/searchRecordingRules',
        method: 'POST',
        body: buildRecordingRuleSearchQuery(pageParam),
      }),
      transformResponse: (response: ListRecordingRuleSearchRulesV0Alpha1ApiResponse): RecordingRuleSearchPage => ({
        hits: response.items.map(toRecordingRuleSearchHit),
        continueToken: response.metadata.continue,
        total: toResultTotal(response.metadata),
      }),
      providesTags: ['RecordingRule'],
    }),
  }),
});

const { useSearchRecordingRulesInfiniteQuery } = recordingRuleSearchAPI;

export function useRecordingRuleSearch(): PagedResult<RecordingRuleSearchHit> & { total?: ResultTotal } {
  const dispatch = useDispatch();
  const query = useSearchRecordingRulesInfiniteQuery();

  const paged = usePagedResult(query, getHits, () => {
    dispatch(recordingRuleSearchAPI.util.updateQueryData('searchRecordingRules', undefined, keepFirstPage));
  });

  // Only the first page's total counts; later pages repeat it and the count never drives paging.
  return { ...paged, total: query.currentData?.pages[0]?.total };
}

function getHits(page: RecordingRuleSearchPage) {
  return page.hits;
}
```

- [ ] **Step 2: Type-check**

```sh
yarn typecheck --project public/app/features/alerting/tsconfig.json 2>&1 | grep recordingRuleSearch
```

Expected: no errors for these files

- [ ] **Step 3: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearch.ts
git commit -m "feat(alerting): add RecordingRule infinite search hook"
```

---

### Task 4: Row component

**Files:**

- Create: `gma-rule-list/recording-rules/RecordingRuleRow.tsx`
- Create: `gma-rule-list/recording-rules/RecordingRuleRow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `RecordingRuleRow.test.tsx`:

```tsx
import { render, screen } from 'test/test-utils';

import { RecordingRuleRow } from './RecordingRuleRow';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

function baseHit(overrides: Partial<RecordingRuleSearchHit> = {}): RecordingRuleSearchHit {
  return { uid: 'rule-1', title: 'cpu:usage:rate5m', folderUid: 'folder-1', ...overrides };
}

function renderRow(props: Parameters<typeof RecordingRuleRow>[0]) {
  return render(
    <ul>
      <RecordingRuleRow {...props} />
    </ul>
  );
}

describe('RecordingRuleRow', () => {
  it('links the title to the rule view and labels the list item with it', () => {
    renderRow({ hit: baseHit() });

    expect(screen.getByRole('link', { name: 'cpu:usage:rate5m' })).toHaveAttribute(
      'href',
      '/alerting/grafana/rule-1/view'
    );
    expect(screen.getByRole('listitem', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
  });

  it('shows the Recording status icon when health is Recording', () => {
    renderRow({ hit: baseHit({ health: 'Recording' }) });

    expect(screen.getByLabelText('Recording')).toBeInTheDocument();
  });

  it('reads Status unavailable, never Recording, when the hit carries no health', () => {
    renderRow({ hit: baseHit() });

    expect(screen.getByLabelText('Status unavailable')).toBeInTheDocument();
  });

  it.each([
    { name: 'is known', folderPath: ['Platform', 'Team Metrics'], shown: true },
    { name: 'is still loading', folderPath: undefined, shown: false },
  ])('shows the folder path only when it $name', ({ folderPath, shown }) => {
    renderRow({ hit: baseHit(), folderPath });

    expect(screen.getByRole('link', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
    expect(screen.queryByText('Team Metrics') !== null).toBe(shown);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.test.tsx
```

Expected: FAIL — `Cannot find module './RecordingRuleRow'`

- [ ] **Step 3: Implement the row**

Create `RecordingRuleRow.tsx`:

```tsx
import { useId } from 'react';

import { TextLink } from '@grafana/ui';

import { grafanaRulesNav } from '../../utils/navigation';
import { FolderPath } from '../rule-row/FolderPath';
import { RuleListItem } from '../rule-row/RuleListItem';
import { RuleStatusIcon } from '../rule-row/RuleStatusIcon';

import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

interface RecordingRuleRowProps {
  hit: RecordingRuleSearchHit;
  /** Absent while the folder path loads or when its lookup failed. */
  folderPath?: string[];
}

/** Presentation-only; missing health renders "unavailable", never recording. */
export function RecordingRuleRow({ hit, folderPath }: RecordingRuleRowProps) {
  const titleId = useId();

  return (
    <RuleListItem
      aria-labelledby={titleId}
      icon={<RuleStatusIcon kind="recording" health={hit.health} paused={hit.paused} />}
      title={
        <TextLink id={titleId} href={grafanaRulesNav.viewLink(hit.uid)} color="primary" inline={false}>
          {hit.title}
        </TextLink>
      }
      meta={[folderPath && folderPath.length > 0 && <FolderPath key="folder" segments={folderPath} />]}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.test.tsx
```

Expected: PASS — 5 tests pass

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.tsx \
        public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.test.tsx
git commit -m "feat(alerting): add RecordingRuleRow presentation component"
```

---

### Task 5: List entry (folder lookup wrapper)

**Files:**

- Create: `gma-rule-list/recording-rules/RecordingRuleListEntry.tsx`

No separate test — covered by the page integration tests in Task 7.

- [ ] **Step 1: Implement**

Create `RecordingRuleListEntry.tsx`:

```tsx
import { useFolderPath } from '../folder-browsing/folderLookups';

import { RecordingRuleRow } from './RecordingRuleRow';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

interface RecordingRuleListEntryProps {
  hit: RecordingRuleSearchHit;
}

/** Runs the per-rule lookups once so the row stays presentation-only. */
export function RecordingRuleListEntry({ hit }: RecordingRuleListEntryProps) {
  const folderPath = useFolderPath(hit.folderUid);

  return <RecordingRuleRow hit={hit} folderPath={folderPath} />;
}
```

- [ ] **Step 2: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleListEntry.tsx
git commit -m "feat(alerting): add RecordingRuleListEntry folder lookup wrapper"
```

---

### Task 6: List view + list view tests

**Files:**

- Create: `gma-rule-list/recording-rules/RecordingRulesListView.tsx`
- Create: `gma-rule-list/recording-rules/RecordingRulesListView.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `RecordingRulesListView.test.tsx`:

```tsx
import { render, screen, userEvent } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { ruleItem } from '../mocks/factories';
import { mockFolderParents, mockRuleSearch } from '../mocks/handlers';

import { RecordingRulesListView } from './RecordingRulesListView';

setupMswServer();

describe('RecordingRulesListView', () => {
  beforeEach(() => {
    mockFolderParents({ 'folder-1': 'Team Metrics' });
  });

  it('shows a lower-bound total with a plus sign', async () => {
    mockRuleSearch('recording', () => ({
      items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
      metadata: { totalHits: 1000, totalHitsRelation: 'lte' },
    }));

    render(<RecordingRulesListView />);

    expect(await screen.findByText('1,000+ recording rules')).toBeInTheDocument();
  });

  it('keeps the first page total after loading more rules', async () => {
    mockRuleSearch('recording', (body) =>
      body.continue
        ? { items: [ruleItem('recording', 'rule-2', 'disk:usage:rate5m', 'folder-1')], metadata: { totalHits: 7 } }
        : {
            items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
            metadata: { totalHits: 2, totalHitsRelation: 'eq', continue: 'tok' },
          }
    );
    render(<RecordingRulesListView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('disk:usage:rate5m')).toBeInTheDocument();
    expect(screen.getByText('2 recording rules')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRulesListView.test.tsx
```

Expected: FAIL — `Cannot find module './RecordingRulesListView'`

- [ ] **Step 3: Implement the list view**

Create `RecordingRulesListView.tsx`:

```tsx
import { t } from '@grafana/i18n';
import { EmptyState, Stack } from '@grafana/ui';

import { ResultCount } from '../rule-row/ResultCount';
import { RuleListSkeleton } from '../rule-row/RuleListSkeleton';
import { RuleRowList } from '../rule-row/RuleRowList';
import { InlineRequestError } from '../shared/InlineRequestError';
import { LoadMoreFooter } from '../shared/LoadMoreFooter';

import { RecordingRuleListEntry } from './RecordingRuleListEntry';
import { useRecordingRuleSearch } from './recordingRuleSearch';

export function RecordingRulesListView() {
  const { items, isLoading, error, failure, hasMore, isLoadingMore, loadMore, retry, total } = useRecordingRuleSearch();

  if (isLoading) {
    return (
      <Stack direction="column" gap={0.5}>
        <ResultCount kind="recording" isLoading />
        <RuleListSkeleton />
      </Stack>
    );
  }

  if (error !== undefined) {
    return (
      <InlineRequestError
        title={t('alerting.gma-rule-list.recording-rules.rules-error', 'Failed to load rules')}
        error={error}
        onRetry={retry}
      />
    );
  }

  if (items.length === 0 && !failure) {
    return (
      <EmptyState
        variant="not-found"
        message={t('alerting.gma-rule-list.recording-rules.no-rules', 'No recording rules found')}
      />
    );
  }

  return (
    <Stack direction="column" gap={0.5}>
      <ResultCount kind="recording" total={total} />
      <RuleRowList>
        {items.map((hit) => (
          <RecordingRuleListEntry key={hit.uid} hit={hit} />
        ))}
      </RuleRowList>
      <LoadMoreFooter
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        failure={failure}
        onLoadMore={loadMore}
        onRetry={retry}
      />
    </Stack>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRulesListView.test.tsx
```

Expected: PASS — 2 tests pass

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRulesListView.tsx \
        public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRulesListView.test.tsx
git commit -m "feat(alerting): add RecordingRulesListView with tests"
```

---

### Task 7: Page component + integration tests

**Files:**

- Create: `gma-rule-list/recording-rules/RecordingRulesPage.tsx`
- Create: `gma-rule-list/recording-rules/RecordingRulesPage.test.tsx`

- [ ] **Step 1: Write the failing integration test**

Create `RecordingRulesPage.test.tsx`:

```tsx
import { HttpResponse, http } from 'msw';
import { render, screen, userEvent, waitFor } from 'test/test-utils';

import { reportInteraction } from '@grafana/runtime';
import server from '@grafana/test-utils/server';

import { setupMswServer } from '../../mockApi';
import { ruleItem } from '../mocks/factories';
import { mockFolderParents, mockRuleSearch, ruleSearchUrl } from '../mocks/handlers';

import RecordingRulesPage from './RecordingRulesPage';

// test-utils replaces locationService per render; a spread would freeze the first one.
jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return Object.defineProperty({ ...actual, reportInteraction: jest.fn() }, 'locationService', {
    enumerable: true,
    get: () => actual.locationService,
  });
});

const reportInteractionMock = jest.mocked(reportInteraction);

setupMswServer();

/** Serves the first page with a continuation token; `nextPage` answers every request that carries one. */
function mockPagedSearch(nextPage: (token: string) => Response | Promise<Response>) {
  const continuations: Array<string | null> = [];
  server.use(
    http.post(ruleSearchUrl('recording'), async ({ request }) => {
      const { continue: token } = (await request.json()) as { continue?: string };
      continuations.push(token ?? null);
      if (!token) {
        return HttpResponse.json({
          items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
          metadata: { continue: 'tok' },
        });
      }
      return nextPage(token);
    })
  );
  return continuations;
}

/** Fails the first POST to `url` with a 500, then answers with `ok`; returns a request counter. */
function failFirstCall(url: string, ok: object) {
  let calls = 0;
  server.use(
    http.post(url, () => {
      calls += 1;
      return calls === 1 ? HttpResponse.json({ message: 'boom' }, { status: 500 }) : HttpResponse.json(ok);
    })
  );
  return () => calls;
}

function secondPage() {
  return HttpResponse.json({
    items: [ruleItem('recording', 'rule-2', 'disk:usage:rate5m', 'folder-2')],
    metadata: {},
  });
}

describe('RecordingRulesPage', () => {
  beforeEach(() => {
    reportInteractionMock.mockClear();
    mockFolderParents({ 'folder-1': 'Team Metrics', 'folder-2': 'Infra' });
  });

  it('lists the Recording rules in the order the search returns them, each with its folder path', async () => {
    mockRuleSearch('recording', () => ({
      items: [
        ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1'),
        ruleItem('recording', 'rule-2', 'disk:usage:rate5m', 'folder-2'),
      ],
      metadata: {},
    }));

    render(<RecordingRulesPage />);

    const rows = await screen.findAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('a')?.textContent)).toEqual(['cpu:usage:rate5m', 'disk:usage:rate5m']);
    expect(await screen.findByText('Team Metrics')).toBeInTheDocument();
    expect(await screen.findByText('Infra')).toBeInTheDocument();
  });

  it('asks searchRecordingRules for 40 rules sorted by title, with no filter', async () => {
    let body: unknown;
    mockRuleSearch('recording', (received) => {
      body = received;
      return { items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')], metadata: {} };
    });

    render(<RecordingRulesPage />);

    expect(await screen.findByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(body).toMatchObject({ kind: 'SearchQuery', sort: [{ field: 'title', direction: 'asc' }], limit: 40 });
    expect(body).not.toHaveProperty('where');
  });

  it("shows the first page's total as the result count", async () => {
    mockRuleSearch('recording', () => ({
      items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
      metadata: { totalHits: 42, totalHitsRelation: 'eq' },
    }));

    render(<RecordingRulesPage />);

    expect(await screen.findByText('42 recording rules')).toBeInTheDocument();
  });

  it('shows skeleton rows in a busy list until the first page arrives', async () => {
    let releasePage: () => void = () => {};
    const pageGate = new Promise<void>((resolve) => {
      releasePage = resolve;
    });
    server.use(
      http.post(ruleSearchUrl('recording'), async () => {
        await pageGate;
        return HttpResponse.json({
          items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
          metadata: {},
        });
      })
    );

    render(<RecordingRulesPage />);

    expect(await screen.findByRole('list', { name: 'Loading rules' })).toHaveAttribute('aria-busy', 'true');
    releasePage();
    expect(await screen.findByRole('link', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Loading rules' })).not.toBeInTheDocument();
  });

  it('shows the empty state after a successful empty response', async () => {
    mockRuleSearch('recording', () => ({ items: [], metadata: {} }));

    render(<RecordingRulesPage />);

    expect(await screen.findByText('No recording rules found')).toBeInTheDocument();
  });

  it('shows a retryable error instead of the empty state when the first page fails', async () => {
    const callCount = failFirstCall(ruleSearchUrl('recording'), {
      items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
      metadata: {},
    });

    render(<RecordingRulesPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load rules');
    expect(screen.queryByText('No recording rules found')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(callCount()).toBe(2);
  });

  it('keeps loaded rows visible when Load more fails and repeats the same continuation request on Retry', async () => {
    let failNext = true;
    const continuations = mockPagedSearch(() => {
      if (failNext) {
        failNext = false;
        return HttpResponse.json({ message: 'boom' }, { status: 500 });
      }
      return secondPage();
    });

    render(<RecordingRulesPage />);

    expect(await screen.findByText('cpu:usage:rate5m')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Failed to load more results')).toBeInTheDocument();
    expect(screen.getByText('cpu:usage:rate5m')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('disk:usage:rate5m')).toBeInTheDocument();
    expect(screen.getByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(continuations).toEqual([null, 'tok', 'tok']);
  });

  it('restarts from the first page on Retry when the server rejected the continuation token', async () => {
    let rejectNext = true;
    const continuations = mockPagedSearch((token) => {
      if (token === 'tok') {
        return HttpResponse.json({
          items: [ruleItem('recording', 'rule-2', 'disk:usage:rate5m', 'folder-2')],
          metadata: { continue: 'tok-2' },
        });
      }
      if (rejectNext) {
        rejectNext = false;
        return HttpResponse.json({ message: 'expired' }, { status: 410 });
      }
      return HttpResponse.json({
        items: [ruleItem('recording', 'rule-3', 'mem:usage:rate5m', 'folder-1')],
        metadata: {},
      });
    });

    render(<RecordingRulesPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    await screen.findByText('disk:usage:rate5m');
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Failed to load more results')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    // Only the first page is fetched again; the pages after it were built on the rejected chain.
    await waitFor(() => expect(screen.queryByText('disk:usage:rate5m')).not.toBeInTheDocument());
    expect(screen.getByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(continuations).toEqual([null, 'tok', 'tok-2', null]);
  });

  it('loads one page once when Load more is double clicked', async () => {
    let releasePage: () => void = () => {};
    const pageGate = new Promise<void>((resolve) => {
      releasePage = resolve;
    });
    const continuations = mockPagedSearch(async () => {
      await pageGate;
      return secondPage();
    });

    render(<RecordingRulesPage />);

    await screen.findByText('cpu:usage:rate5m');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load more' })).toBeDisabled());
    releasePage();

    expect(await screen.findByText('disk:usage:rate5m')).toBeInTheDocument();
    expect(continuations).toEqual([null, 'tok']);
  });

  it('reports one page view in List mode per mount, not again on re-render', async () => {
    mockRuleSearch('recording', () => ({ items: [], metadata: {} }));
    const pageViewCalls = () =>
      reportInteractionMock.mock.calls.filter(([event]) => event === 'grafana_alerting_gma_rule_list_view');

    const { rerender } = render(<RecordingRulesPage />);
    await screen.findByText('No recording rules found');
    expect(pageViewCalls()).toEqual([['grafana_alerting_gma_rule_list_view', { kind: 'recording', mode: 'list' }]]);

    rerender(<RecordingRulesPage />);
    await screen.findByText('No recording rules found');

    expect(pageViewCalls()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRulesPage.test.tsx
```

Expected: FAIL — `Cannot find module './RecordingRulesPage'`

- [ ] **Step 3: Implement the page**

Create `RecordingRulesPage.tsx`:

```tsx
import { Box } from '@grafana/ui';

import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { useTrackRuleListPageView } from '../shared/analytics';

import { RecordingRulesListView } from './RecordingRulesListView';

function RecordingRulesPage() {
  useTrackRuleListPageView('recording', 'list');

  return (
    // The heading comes from the navId, so it also drives breadcrumbs and nav highlighting.
    <AlertingPageWrapper navId="recording-rules">
      <Box paddingTop={2}>
        <RecordingRulesListView />
      </Box>
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(RecordingRulesPage);
```

- [ ] **Step 4: Run tests to verify they pass**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRulesPage.test.tsx
```

Expected: PASS — 9 tests pass

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRulesPage.tsx \
        public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRulesPage.test.tsx
git commit -m "feat(alerting): add RecordingRulesPage with integration tests"
```

---

### Task 8: Route registration

**Files:**

- Modify: `public/app/features/alerting/routes.tsx`
- Modify: `public/app/features/alerting/routes.test.tsx`

- [ ] **Step 1: Update the route test first**

In `routes.test.tsx`, find the describe block `'GMA-only Alert rules route'`. Update the test `'registers /alerting/rules/alert only with the flag on and adds no other route'` and add a permissions test for the recording route. Replace the existing describe block content:

```ts
describe('GMA-only Alert rules route', () => {
  const previousPermissions = contextSrv.user.permissions;

  afterEach(() => {
    setTestFlags();
    contextSrv.user.permissions = previousPermissions;
  });

  function getRoutes(flag: boolean) {
    setTestFlags({ [FlagKeys.AlertingGmaOnlyListView]: flag });
    return getAlertingRoutes();
  }

  it('registers /alerting/rules/alert and /alerting/rules/recording only with the flag on', () => {
    const routesOff = getRoutes(false);
    const routesOn = getRoutes(true);

    expect(routesOff.map((route) => route.path)).not.toContain('/alerting/rules/alert');
    expect(routesOff.map((route) => route.path)).not.toContain('/alerting/rules/recording');
    expect(routesOn.map((route) => route.path)).toEqual([
      ...routesOff.map((route) => route.path),
      '/alerting/rules/alert',
      '/alerting/rules/recording',
    ]);
  });

  it('denies a user with only data source-managed read and admits a Grafana-managed reader (alert route)', () => {
    const guard = getRoutes(true).find((route) => route.path === '/alerting/rules/alert')?.roles;

    contextSrv.user.permissions = { [AccessControlAction.AlertingRuleExternalRead]: true };
    expect(guard?.()).toEqual(['Reject']);

    contextSrv.user.permissions = { [AccessControlAction.AlertingRuleRead]: true };
    expect(guard?.()).toEqual([]);
  });

  it('denies a user with only data source-managed read and admits a Grafana-managed reader (recording route)', () => {
    const guard = getRoutes(true).find((route) => route.path === '/alerting/rules/recording')?.roles;

    contextSrv.user.permissions = { [AccessControlAction.AlertingRuleExternalRead]: true };
    expect(guard?.()).toEqual(['Reject']);

    contextSrv.user.permissions = { [AccessControlAction.AlertingRuleRead]: true };
    expect(guard?.()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run route test to verify it fails**

```sh
yarn jest --no-watch public/app/features/alerting/routes.test.tsx -t "GMA-only"
```

Expected: FAIL — assertion expects `/alerting/rules/recording` in routesOn but it's missing

- [ ] **Step 3: Add the route to routes.tsx**

In `routes.tsx`, find the `shouldUseGmaOnlyListView()` block that pushes the alert rules route. Add the recording route immediately after the alert rules push:

```ts
if (shouldUseGmaOnlyListView()) {
  // The GMA-only Alert rules page requires Grafana-managed read only, not the legacy GMA-or-DMA combo.
  routes.push({
    path: '/alerting/rules/alert',
    roles: evaluateAccess([AccessControlAction.AlertingRuleRead]),
    component: importAlertingComponent(
      () =>
        import(
          /* webpackChunkName: "GmaAlertRulesPage" */ 'app/features/alerting/unified/gma-rule-list/alert-rules/AlertRulesPage'
        )
    ),
  });
  routes.push({
    path: '/alerting/rules/recording',
    roles: evaluateAccess([AccessControlAction.AlertingRuleRead]),
    component: importAlertingComponent(
      () =>
        import(
          /* webpackChunkName: "GmaRecordingRulesPage" */ 'app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRulesPage'
        )
    ),
  });
}
```

- [ ] **Step 4: Run route test to verify it passes**

```sh
yarn jest --no-watch public/app/features/alerting/routes.test.tsx -t "GMA-only"
```

Expected: PASS — 3 tests pass

- [ ] **Step 5: Run all routes tests to check for regressions**

```sh
yarn jest --no-watch public/app/features/alerting/routes.test.tsx
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```sh
git add public/app/features/alerting/routes.tsx \
        public/app/features/alerting/routes.test.tsx
git commit -m "feat(alerting): register /alerting/rules/recording route behind gmaOnlyListView"
```

---

### Task 9: Final check

- [ ] **Step 1: Run all new test files together**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/
```

Expected: all tests pass

- [ ] **Step 2: Run the full alerting test suite to check for regressions**

```sh
yarn jest --no-watch public/app/features/alerting/
```

Expected: no new failures

- [ ] **Step 3: TypeScript check**

```sh
yarn typecheck 2>&1 | grep -i "recording-rules\|RecordingRule" | head -20
```

Expected: no errors in the new files
