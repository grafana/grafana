/**
 * A library containing the different design components of the Grafana ecosystem.
 *
 * @packageDocumentation
 */
export * from './components';
export * from './types';
export * from './utils';
export * from './themes';
export * from './slate-plugins';

export const useNewTheme = () => 'NEW THEME';

export const DEPRECATED_COMPAT_EXPORTS = {
  useNewTheme: () => 'DEPRECATED OLD THEME',
};

// Exposes standard editors for registries of optionsUi config and panel options UI
export { getStandardFieldConfigs, getStandardOptionEditors } from './utils/standardEditors';
