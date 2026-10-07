import { type NavEntryBuilder } from './utils';

/** A nav item contributed from outside the static tree (e.g. the enterprise bundle) */
export interface NavEntryExtension {
  /** NavID of the section or subsection to append into, or 'root' for a top-level entry */
  parentId: string;
  entry: NavEntryBuilder;
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
