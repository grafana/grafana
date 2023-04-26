/**
 * A library containing most of the static shapes required by Grafana.
 *
 * @packageDocumentation
 */
export * from './veneer/common.types';
export * from './index.gen';

// TODO: The following imports should be included in ./index.gen
export type { Team } from './raw/team/x/team_types.gen';
export type { LibraryPanel } from './veneer/librarypanel.types';
export type { Dashboard } from './veneer/dashboard.types';
export { defaultDashboard } from './veneer/dashboard.types';
