import { UserStorage } from '@grafana/runtime/internal';

// Constructed lazily, on first use, rather than at module scope: this file is imported
// transitively (via DashboardSceneUrlSync) by every dashboard-scene module, so an eager
// `new UserStorage(...)` here runs during module evaluation of anything that pulls this in --
// including test files mocking `UserStorage` with a jest.fn() declared below their own imports,
// which would otherwise see that mock fn before it's initialized.
let userStorage: UserStorage | undefined;
function storage(): UserStorage {
  if (!userStorage) {
    userStorage = new UserStorage('saved-dashboard-views');
  }
  return userStorage;
}

// One key per dashboard, not one blob keyed by dashboard the way some UserStorage consumers do --
// a user's dashboard count is unbounded and grows over the account's life, so a shared blob would
// mean every dashboard's default-check parses an ever-growing object and every write contends on
// the same per-service UserStorage write lock.
const getDefaultViewKey = (dashboardUID: string) => `default-view-${dashboardUID}`;

/** Stores `metadata.name` (the immutable resource id), never `spec.name` (the renamable label). */
export const getDefaultSavedView = async (dashboardUID: string): Promise<string | undefined> => {
  const value = await storage().getItem(getDefaultViewKey(dashboardUID));
  return value ?? undefined;
};

export const setDefaultSavedView = async (dashboardUID: string, viewName: string | undefined): Promise<void> => {
  const key = getDefaultViewKey(dashboardUID);
  if (viewName === undefined) {
    await storage().deleteItem(key);
    return;
  }
  await storage().setItem(key, viewName);
};
