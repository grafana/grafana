import { resolveSelectors } from '../resolver';
import { E2ESelectors } from '../types';

import { versionedComponents, VersionedComponents } from './components';
import { versionedPages, VersionedPages } from './pages';

const Pages = resolveSelectors(versionedPages);
const Components = resolveSelectors(versionedComponents);
const selectors = { pages: Pages, components: Components };

/**
 * Exposes Pages, Component selectors and E2ESelectors type in package for easy use in e2e tests and in production code
 */
export {
  Pages,
  Components,
  selectors,
  versionedComponents,
  versionedPages,
  resolveSelectors,
  type VersionedPages,
  type VersionedComponents,
  type E2ESelectors,
};
