import { resolveSelectors } from '../resolver';
import { E2ESelectors } from '../types';

export const selectors = resolveSelectors();
const Pages = selectors.pages;
const Components = selectors.components;

/**
 * Exposes Pages, Component selectors and E2ESelectors type in package for easy use in e2e tests and in production code
 */
export { Pages, Components, resolveSelectors, type E2ESelectors };
