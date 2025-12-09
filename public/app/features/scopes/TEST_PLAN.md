# Scopes Selector - Test Plan for defaultPath Implementation

This document outlines the comprehensive test coverage for implementing the `defaultPath` feature and refactoring path resolution logic.

## Test Files Created

### 1. `ScopesSelectorService.defaultPath.test.ts`

**Purpose**: Tests the core `defaultPath` functionality and integration with the service

**Coverage**:

- ✅ `getScopeNodes()` method
  - Returns cached nodes without API calls
  - Fetches only non-cached nodes (partial cache hits)
  - Maintains order of requested nodes
  - Updates state with fetched nodes
  - Handles empty arrays and undefined nodes

- ✅ `resolvePathToRoot()` with `defaultPath`
  - Uses `defaultPath` when available from scope metadata
  - Falls back to recursive walking when no `scopeId` provided
  - Falls back when scope exists but has no `defaultPath`
  - Inserts path nodes into tree structure
  - Handles errors gracefully

- ✅ `applyScopes()` with pre-fetching
  - Pre-fetches all nodes from `defaultPath` when applying scopes
  - Handles multiple scopes with different `defaultPath`s
  - Deduplicates node IDs across multiple paths
  - Skips fetching when no `defaultPath` defined
  - Handles empty `defaultPath` arrays

- ✅ Selector opening with `defaultPath` expansion
  - Expands tree to `defaultPath` when opening selector
  - Falls back to `parentNodeId` when no `defaultPath`
  - Handles cases where scope metadata isn't loaded yet

- ✅ Performance improvements
  - Single API call for deep hierarchy with `defaultPath`
  - Documents N API calls for old recursive behavior (baseline)

- ✅ Edge cases and error handling
  - Handles `defaultPath` with missing nodes
  - Handles API errors during batch fetch
  - Deduplicates node IDs in `defaultPath`
  - Handles `defaultPath` with only root node

- ✅ Backwards compatibility
  - Works without providing `scopeId` to `resolvePathToRoot`
  - Handles async scope loading

### 2. `ScopesSelectorService.pathHelpers.test.ts`

**Purpose**: Tests the refactored helper methods for path resolution

**Coverage**:

- ✅ `getPathForScope()` (new unified method)
  - Prefers `defaultPath` from scope metadata
  - Falls back to `scopeNodeId` when no `defaultPath`
  - Returns empty array when both are undefined
  - Handles scope not being in cache

- ✅ `getNodePath()` - optimized implementation
  - Builds path from cached nodes without API calls
  - Fetches missing nodes in the path
  - Handles circular references gracefully
  - Stops at root node (empty `parentName`)

- ✅ `expandToSelectedScope()` (new helper method)
  - Expands tree to show selected scope path
  - Does not expand when no scopes selected
  - Loads children of the last node in path
  - Handles errors gracefully during expansion

- ✅ Integration tests
  - Full flow: resolve → insert → expand
  - Uses cached nodes to avoid unnecessary API calls

- ✅ `getScopeNode()` caching behavior
  - Returns cached node without API call
  - Fetches and caches when not in cache
  - Handles API errors gracefully

### 3. `ScopesApiClient.test.ts`

**Purpose**: Tests the API client methods, especially batch fetching

**Coverage**:

- ✅ `fetchMultipleScopeNodes()`
  - Fetches multiple nodes by names
  - Returns empty array when names array is empty
  - Respects feature toggle
  - Handles API errors gracefully
  - Handles missing or null items in response
  - Handles large arrays (100+ nodes)
  - Passes through special characters in node names

- ✅ `fetchScopeNode()`
  - Fetches single node by ID
  - Respects feature toggle
  - Returns undefined on error

- ✅ `fetchNodes()`
  - Supports parent filter
  - Supports query filter
  - Respects custom limit
  - Validates limit bounds (1-10000)
  - Uses default limit of 1000
  - Handles API errors

- ✅ `fetchScope()` and `fetchMultipleScopes()`
  - Basic fetch operations
  - Error handling
  - Parallel fetching
  - Filters undefined results

- ✅ Performance comparison
  - Single batched request with `fetchMultipleScopeNodes`
  - N sequential requests with `fetchScopeNode` (old pattern)

### 4. Existing Tests (Reference)

**File**: `ScopesSelectorService.test.ts` (existing, not modified)

- ✅ Select/deselect scope behavior
- ✅ Apply scopes and change scopes
- ✅ Open/close/apply selector
- ✅ Toggle and filter nodes
- ✅ Redirect behavior
- ✅ Recent scopes handling
- ✅ Navigation scope interaction

**File**: `scopesTreeUtils.test.ts` (existing, not modified)

- ✅ Tree manipulation utilities
- ✅ Path calculation
- ✅ Node expansion/collapse

## Test Scenarios Summary

### Happy Path Scenarios

1. **Basic defaultPath usage**: Scope has `defaultPath` → fetches all nodes in one call → expands tree
2. **Multiple scopes**: Multiple scopes with `defaultPath` → deduplicates and fetches all unique nodes
3. **Cached nodes**: Nodes already in cache → skips fetching → instant expansion
4. **Mixed cache state**: Some nodes cached, some not → fetches only missing ones

### Fallback Scenarios

1. **No defaultPath**: Scope has no `defaultPath` → falls back to recursive node walking
2. **No scope metadata**: Scope not loaded yet → falls back to node-based path
3. **Feature toggle disabled**: Toggle off → returns empty results safely

### Edge Cases

1. **Empty arrays**: Empty `defaultPath` or no nodes → handled gracefully
2. **Missing nodes**: API returns partial results → continues with what's available
3. **Circular references**: Node references itself/parent → detects and prevents infinite loops
4. **API failures**: Network errors → returns empty arrays, doesn't crash
5. **Large datasets**: 100+ nodes in path → handles efficiently

### Performance Tests

1. **Batch vs sequential**: Documents 1 API call (batch) vs N calls (sequential)
2. **Cache efficiency**: Verifies cached nodes don't trigger API calls
3. **Deduplication**: Multiple paths sharing nodes → fetches each node once

## Running the Tests

```bash
# Run all scope-related tests
yarn test:frontend scopes

# Run specific test files
yarn test:frontend ScopesSelectorService.defaultPath.test.ts
yarn test:frontend ScopesSelectorService.pathHelpers.test.ts
yarn test:frontend ScopesApiClient.test.ts

# Run existing tests to ensure no regressions
yarn test:frontend ScopesSelectorService.test.ts
yarn test:frontend scopesTreeUtils.test.ts
```

## Coverage Goals

### Before Implementation

- [x] Comprehensive test coverage written
- [x] Edge cases identified and tested
- [x] Performance benchmarks documented
- [x] Backwards compatibility validated

### During Implementation

- [ ] All new tests passing
- [ ] Existing tests still passing (no regressions)
- [ ] Code coverage for new methods: >90%

### After Implementation

- [ ] Integration tests passing
- [ ] Manual testing with real data
- [ ] Performance validation (1 call vs N calls)
- [ ] Documentation updated

## Key Test Patterns Used

### 1. Mock Setup Pattern

```typescript
beforeEach(() => {
  // Clear all mocks
  // Setup consistent mock implementations
  // Initialize service with mocks
});
```

### 2. State Verification Pattern

```typescript
// Given: Initial state
service.updateState({ ... });

// When: Action performed
await service.someMethod();

// Then: Verify state changes
expect(service.state.nodes).toEqual(...);
```

### 3. API Call Verification Pattern

```typescript
// When: Method that should make API call
await service.fetchSomething();

// Then: Verify correct API usage
expect(apiClient.method).toHaveBeenCalledWith(expectedParams);
expect(apiClient.method).toHaveBeenCalledTimes(1);
```

### 4. Error Handling Pattern

```typescript
// Given: API that will fail
mockApi.method.mockRejectedValue(new Error('...'));

// When: Method called
const result = await service.method();

// Then: Graceful handling
expect(result).toEqual(safeDefault);
expect(service.state).toBeConsistent();
```

## Notes for Implementation

1. **Method Signatures**: Tests assume these new/modified methods:
   - `getScopeNodes(names: string[]): Promise<ScopeNode[]>`
   - `resolvePathToRoot(nodeId: string, tree: TreeNode, scopeId?: string)`
   - Helper methods: `getPathForScope()`, `expandToSelectedScope()`

2. **Feature Toggles**: Tests verify feature toggle behavior:
   - `useMultipleScopeNodesEndpoint` - for batch fetching
   - `useScopeSingleNodeEndpoint` - for single node fetching

3. **Error Handling**: All new methods should:
   - Return safe defaults (empty arrays, undefined)
   - Log errors to console
   - Not throw exceptions that crash the UI

4. **Caching Strategy**: Tests validate:
   - Check cache before API calls
   - Update cache after successful fetches
   - Use stale cache if API fails

5. **Performance**: Key optimization:
   - `defaultPath` → 1 API call (O(1))
   - Recursive → N API calls (O(depth))
   - For 5-level hierarchy: 5x performance improvement

## Test Data Hierarchy

Tests use a realistic hierarchy:

```
Region (region-us-west)
└── Country (country-usa)
    └── City (city-seattle)
        └── Datacenter (datacenter-sea-1) [scope-sea-1]
```

This represents a typical organizational structure and exercises:

- Multiple levels of nesting
- Container and leaf nodes
- Scope linking at leaf level
- Real-world naming patterns
