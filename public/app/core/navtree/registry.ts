// Type-only: appNavConfig imports getRegisteredAppNavConfig as a value, and a
// value import back would make the two modules a cycle while both are still
// initialising
import { type AppNavConfig } from './appNavConfig';
import { type NavEntryBuilder } from './utils';

/** A nav item contributed from outside the static tree (e.g. the enterprise bundle) */
export interface NavEntryExtension {
  /** NavID of the section or subsection to append into, or 'root' for a top-level entry */
  parentId: string;
  entry: NavEntryBuilder;
  /** Ids to land behind, in preference order; absent appends. See appendIntoSection */
  after?: string[];
}

const registeredNavEntries: NavEntryExtension[] = [];

/**
 * Registers nav items to be appended into the client-built static tree,
 * following the addPageBanner pattern: a module-level registry the enterprise
 * bundle fills at startup. Must be called before the redux store is created
 * (the tree is first built inside configureStore), i.e. from module scope or
 * addExtensionReducers — not from the extensions init() hook, which runs
 * after.
 */
export function addNavEntries(...extensions: NavEntryExtension[]): void {
  registeredNavEntries.push(...extensions);
}

export function getRegisteredNavEntries(): readonly NavEntryExtension[] {
  return registeredNavEntries;
}

export function clearRegisteredNavEntries(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('clearRegisteredNavEntries() can only be called from tests.');
  }
  registeredNavEntries.length = 0;
}

const registeredAppNavConfig: Record<string, AppNavConfig> = {};

/**
 * Registers where app plugins go in the nav, for apps the static table in
 * appNavConfig does not cover (e.g. the enterprise bundle's own apps). Same
 * timing rule as addNavEntries above.
 */
export function addAppNavConfig(entries: Record<string, AppNavConfig>): void {
  Object.assign(registeredAppNavConfig, entries);
}

export function getRegisteredAppNavConfig(): Readonly<Record<string, AppNavConfig>> {
  return registeredAppNavConfig;
}

export function clearRegisteredAppNavConfig(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('clearRegisteredAppNavConfig() can only be called from tests.');
  }
  for (const appId of Object.keys(registeredAppNavConfig)) {
    delete registeredAppNavConfig[appId];
  }
}
