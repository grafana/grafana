# Saved Searches Feature

The Saved Searches feature allows users to save, manage, and quickly apply search queries on the Alert Rules page.

## Overview

Users can:

- **Save** the current search query with a custom name
- **Apply** a saved search to instantly filter rules
- **Rename** existing saved searches
- **Delete** saved searches they no longer need
- **Set a default** search that auto-applies when navigating to the page

## Components

### `<SavedSearches />`

The main component that renders a button and dropdown for managing saved searches.

```tsx
import { SavedSearches } from './SavedSearches';

<SavedSearches
  savedSearches={savedSearches}
  currentSearchQuery={searchQuery}
  onSave={handleSave}
  onRename={handleRename}
  onDelete={handleDelete}
  onApply={handleApply}
  onSetDefault={handleSetDefault}
/>;
```

#### Props

| Prop                 | Type                                                                | Required | Description                                 |
| -------------------- | ------------------------------------------------------------------- | -------- | ------------------------------------------- |
| `savedSearches`      | `SavedSearch[]`                                                     | Yes      | Array of saved search objects               |
| `currentSearchQuery` | `string`                                                            | Yes      | The current search query in the input field |
| `onSave`             | `(name: string, query: string) => Promise<void \| ValidationError>` | Yes      | Called when user saves a new search         |
| `onRename`           | `(id: string, newName: string) => Promise<void \| ValidationError>` | Yes      | Called when user renames a search           |
| `onDelete`           | `(id: string) => Promise<void>`                                     | Yes      | Called when user deletes a search           |
| `onApply`            | `(search: SavedSearch) => void`                                     | Yes      | Called when user applies a search           |
| `onSetDefault`       | `(id: string \| null) => Promise<void>`                             | Yes      | Called when user sets/clears default        |

#### Types

```typescript
interface SavedSearch {
  /** Unique identifier */
  id: string;
  /** User-provided name */
  name: string;
  /** The search query string */
  query: string;
  /** Whether this is the default search */
  isDefault: boolean;
  /** Unix timestamp of creation */
  createdAt: number;
}

interface ValidationError {
  /** The field with the error */
  field: string;
  /** Error message to display */
  message: string;
}
```

### `useSavedSearches()` Hook

A custom hook that manages saved searches with UserStorage persistence.

```tsx
import { useSavedSearches, trackSavedSearchApplied } from './useSavedSearches';

const { savedSearches, isLoading, saveSearch, renameSearch, deleteSearch, setDefaultSearch, getAutoApplySearch } =
  useSavedSearches();

// Track when a search is applied
const handleApply = (search: SavedSearch) => {
  applySearchToFilter(search.query);
  trackSavedSearchApplied(search);
};
```

#### Return Value

| Property             | Type                                                | Description                           |
| -------------------- | --------------------------------------------------- | ------------------------------------- |
| `savedSearches`      | `SavedSearch[]`                                     | Current list of saved searches        |
| `isLoading`          | `boolean`                                           | Whether initial load is in progress   |
| `saveSearch`         | `(name, query) => Promise<void \| ValidationError>` | Save a new search                     |
| `renameSearch`       | `(id, newName) => Promise<void \| ValidationError>` | Rename an existing search             |
| `deleteSearch`       | `(id) => Promise<void>`                             | Delete a search                       |
| `setDefaultSearch`   | `(id \| null) => Promise<void>`                     | Set or clear the default search       |
| `getAutoApplySearch` | `() => SavedSearch \| null`                         | Get the default search for auto-apply |

## Integration

### Basic Integration

```tsx
import { SavedSearches, SavedSearch } from './SavedSearches';
import { useSavedSearches, trackSavedSearchApplied } from './useSavedSearches';

function MyFilterComponent() {
  const { filterState, updateFilters } = useMyFilter();

  const { savedSearches, saveSearch, renameSearch, deleteSearch, setDefaultSearch, getAutoApplySearch } =
    useSavedSearches();

  // Handle applying a saved search
  const handleApply = useCallback(
    (search: SavedSearch) => {
      // Update your filter state with the saved query
      updateFilters(parseQuery(search.query));

      // Track analytics
      trackSavedSearchApplied(search);
    },
    [updateFilters]
  );

  // Auto-apply default search on navigation
  useEffect(() => {
    const defaultSearch = getAutoApplySearch();
    if (defaultSearch) {
      handleApply(defaultSearch);
    }
  }, [getAutoApplySearch, handleApply]);

  return (
    <SavedSearches
      savedSearches={savedSearches}
      currentSearchQuery={filterState.searchQuery}
      onSave={saveSearch}
      onRename={renameSearch}
      onDelete={deleteSearch}
      onApply={handleApply}
      onSetDefault={setDefaultSearch}
    />
  );
}
```

### Feature Toggle

The feature is gated behind the `alertingSavedSearches` feature toggle:

```tsx
import { shouldUseSavedSearches } from '../../featureToggles';

function MyComponent() {
  const savedSearchesEnabled = shouldUseSavedSearches();

  return (
    <>
      {savedSearchesEnabled && <SavedSearches ... />}
    </>
  );
}
```

To enable during development, set in Grafana config:

```ini
[feature_toggles]
alertingSavedSearches = true
```

## Behavior

### Dropdown States

1. **List Mode** (default)
   - Shows saved searches sorted: default first, then alphabetical
   - Shows "Save current search" button when `currentSearchQuery` is non-empty
   - Empty state when no saved searches exist

2. **Save Mode**
   - Name input with validation
   - Save/Cancel buttons
   - Triggered by clicking "Save current search"

3. **Rename Mode** (per-item)
   - Inline editing of search name
   - Confirm with Enter, cancel with Escape

4. **Delete Confirmation** (per-item)
   - Inline confirmation prompt
   - Delete/Cancel buttons

### Validation Rules

| Rule                           | Message                                        |
| ------------------------------ | ---------------------------------------------- |
| Name required                  | "Name is required"                             |
| Max length 64                  | "Name must be 64 characters or less"           |
| Unique name (case-insensitive) | "A saved search with this name already exists" |

### Auto-Apply Default Search

The default search auto-applies when:

1. User **navigates** to the Alert Rules page (not on refresh)
2. No search query is present in the URL
3. A default search is configured

This is tracked via `sessionStorage` to distinguish navigation from refresh.

### Persistence

Saved searches are stored using `UserStorage`:

- **Backend API**: `/apis/userstorage.grafana.app/v0alpha1/namespaces/{namespace}/user-storage`
- **Fallback**: `localStorage` (when user not signed in or API fails)
- **Storage key**: `alerting.savedSearches`

## Analytics

The feature tracks the following events via `reportInteraction`:

| Event                                       | Properties                 | When                 |
| ------------------------------------------- | -------------------------- | -------------------- |
| `grafana_alerting_saved_search_save`        | `hasDefault`, `totalCount` | Search saved         |
| `grafana_alerting_saved_search_apply`       | `isDefault`                | Search applied       |
| `grafana_alerting_saved_search_delete`      | -                          | Search deleted       |
| `grafana_alerting_saved_search_rename`      | -                          | Search renamed       |
| `grafana_alerting_saved_search_set_default` | `action: 'set' \| 'clear'` | Default changed      |
| `grafana_alerting_saved_search_auto_apply`  | -                          | Default auto-applied |

## Testing

### Component Tests

Location: `SavedSearches.test.tsx`

```bash
yarn test SavedSearches.test.tsx
```

Test categories:

- **Rendering**: Button, dropdown, list sorting, empty state
- **Save functionality**: Validation, errors, success flow
- **Apply functionality**: Click handling, dropdown close
- **Action menu**: Set default, rename, delete options
- **Delete confirmation**: Confirm/cancel flows
- **Keyboard navigation**: Escape key handling
- **Edge cases**: Empty queries, whitespace trimming

### Hook Tests

Location: `useSavedSearches.test.tsx`

```bash
yarn test useSavedSearches.test.tsx
```

Test categories:

- **Initial loading**: Loading state, storage load, empty storage
- **saveSearch**: New search, duplicate detection, analytics
- **renameSearch**: Rename flow, duplicate detection
- **deleteSearch**: Delete flow, analytics
- **setDefaultSearch**: Set/clear default, analytics
- **getAutoApplySearch**: Navigation detection, URL check
- **Error handling**: Storage errors, notifications

### Mocking UserStorage API with MSW

The hook tests use MSW to mock the UserStorage API endpoints:

```typescript
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

const USER_STORAGE_BASE_URL = `/apis/userstorage.grafana.app/v0alpha1/namespaces/${config.namespace}/user-storage`;

const handlers = [
  http.get(`${USER_STORAGE_BASE_URL}/:resourceName`, () => {
    return HttpResponse.json({ spec: { data: mockStorageData } });
  }),
  http.patch(`${USER_STORAGE_BASE_URL}/:resourceName`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ spec: { data: body.spec.data } });
  }),
];

const server = setupServer(...handlers);
```

### Verifying Notifications in UI

Tests verify error notifications by rendering the `AppNotificationList` component:

```typescript
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { getWrapper, screen } from 'test/test-utils';

function createWrapper() {
  const Wrapper = getWrapper({ renderWithRouter: true });
  return function WrapperWithNotifications({ children }) {
    return (
      <Wrapper>
        <AppNotificationList />
        {children}
      </Wrapper>
    );
  };
}

// In tests:
const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });
expect(await screen.findByText(/failed to save/i)).toBeInTheDocument();
```

## Accessibility

- Dropdown has `role="dialog"` for screen readers
- Action menu uses `@grafana/ui` `Dropdown` and `Menu` components
- Keyboard support:
  - `Escape`: Close dropdown or cancel current operation
  - `Tab`: Navigate through interactive elements
  - `Enter`: Confirm inputs

## File Structure

```
public/app/features/alerting/unified/rule-list/filter/
├── SavedSearches.tsx          # Main component
├── SavedSearches.test.tsx     # Component tests
├── SavedSearches.README.md    # This documentation
├── useSavedSearches.ts        # Custom hook with persistence
└── useSavedSearches.test.tsx  # Hook tests
```

## Dependencies

- `@grafana/ui`: Button, Dropdown, Menu, Icon, Input, Stack, Box, Spinner, PopupCard
- `@grafana/i18n`: Trans, t (internationalization)
- `@grafana/runtime`: reportInteraction
- `@grafana/runtime/internal`: UserStorage
- `@emotion/css`: Styling via useStyles2

## E2E Tests

Location: `e2e-playwright/alerting-suite/saved-searches.spec.ts`

```bash
yarn e2e:playwright --grep "saved-searches"
```

Test scenarios:

- Display Saved searches button
- Open/close dropdown
- Empty state
- Save current search (enabled/disabled)
- Create new saved search
- Validation errors (duplicate name)
- Apply saved search
- Rename saved search
- Delete saved search
- Set as default
- Keyboard navigation (Escape to close/cancel)
