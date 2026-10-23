import { UserStorage } from '@grafana/runtime/internal';

// Created lazily: this module loads with every dashboard-scene import, and an eager instance
// would hit tests' UserStorage mocks before they're initialized.
let userStorage: UserStorage | undefined;
function storage(): UserStorage {
  if (!userStorage) {
    userStorage = new UserStorage('saved-dashboard-views');
  }
  return userStorage;
}

// One key per dashboard rather than one shared blob, which would grow with every dashboard.
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
