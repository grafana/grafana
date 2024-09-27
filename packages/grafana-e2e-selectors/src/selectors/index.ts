import { Components } from '../generated/components.gen';
import { Pages } from '../generated/pages.gen';
import { resolveSelectors } from '../resolver';
import { E2ESelectors } from '../types';

export type E2ESelectorGroup = {
  pages: E2ESelectors<typeof Pages>;
  components: E2ESelectors<typeof Components>;
};

/**
 * Exposes selectors in package for easy use in e2e tests and in production code
 */
export const selectors: E2ESelectorGroup = {
  pages: Pages,
  components: Components,
};

/**
 * Exposes Pages, Component selectors and E2ESelectors type in package for easy use in e2e tests and in production code
 */
export { Pages, Components, resolveSelectors, type E2ESelectors };
