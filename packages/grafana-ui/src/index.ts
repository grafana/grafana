/**
 * A library containing the different design components of the Grafana ecosystem.
 *
 * @packageDocumentation
 */
export * from './components';
export * from './types';
export * from './utils';
export * from './themes';
export * from './options';
export * from './slate-plugins';

// Moved to `@grafana/schema`, in Grafana 9, this will be removed
export * from './schema';

// Exposes standard editors for registries of optionsUi config and panel options UI
export { getStandardFieldConfigs, getStandardOptionEditors } from './utils/standardEditors';

// TESTING
// This is only for testing the breaking-changes workflow and is not going to be merged in.
export const foo = "zed";
